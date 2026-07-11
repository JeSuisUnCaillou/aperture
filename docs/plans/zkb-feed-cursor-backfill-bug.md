# zKB feed cursor-seed backfill bug

**Goal:** Stop the zKB live feed from (a) silently dying when the boot seed fails and (b) firing phantom red underglow flashes for stale kills zKB injects into the live feed. These are two independent bugs found in one investigation; each has its own stage below.
**References:** `src/lib/integrations/zkbFeed.ts`, `src/lib/integrations/zkbFeed.md`, `src/lib/integrations/zkb.ts` (`zkbKillSchema`).

## The bug

`pollOnce` seeds the cursor to the feed's current sequence on boot so only kills happening *now* surface (never backfill). On a failed seed it instead falls back to `0`:

```ts
// zkbFeed.ts — cursor === null branch
const { body } = await fetchJson(`${BASE}/sequence.json`, signal);
const parsed = sequenceSchema.safeParse(body);
state.cursor = parsed.success ? parsed.data.sequence : 0;   // ← bug
```

`fetchJson` returns `{ body: null }` for any non-200 that isn't 404/429, so a `5xx`/`404` on `sequence.json` — or a `sequence.json` whose shape isn't `{ sequence: number }` — makes `safeParse` fail and seeds the cursor to `0`. The next tick then walks `seq = 1` upward:

- **Old sequences still resolve** → the feed replays history from the start, firing `systemNotification`s for long-past kills in whatever systems are currently on a map. This is the phantom flash: a red underglow with no matching recent kill on zKB. It is sticky — the walk advances only `ZKB_FEED_MAX_CATCHUP` per tick, so it keeps throwing stale flashes for a long time.
- **Old sequences 404** → it breaks on `seq 1` and wedges at cursor `0` forever (cursor is no longer `null`, so it never re-seeds) → feed silently dies.

> **Correction (verified against the live feed, 2026-07-06):** only the second sub-case is physically realizable. The R2Z2 `ephemeral` feed retains only a rolling ~week-long window; sequence `1` (and everything below ~seq 98.0–98.3M) returns **404**. So a cursor of `0` walks to `seq 1`, hits a 404 on the very first request, `break`s (the walk treats the first 404 as "caught up"), and never advances — it re-requests `seq 1` every tick forever. **cursor=0 replays zero killmails; it silently kills the feed.** The "replays history from the start" sub-case would require the ephemeral feed to retain from seq 1, which by design it never does. Consequently the cursor=0 bug is a *silent-outage* bug, **not** a phantom-flash bug — the observed flashes are the zKB-side stale-injection cause below. The fix (leave cursor `null`) is still correct: it prevents the silent outage.

## Stage 1 — cursor-null seed (silent-outage fix)
**Mode:** Accept edits
**Goal:** A failed `sequence.json` seed must leave the cursor `null` so the next tick retries, never fall back to `0`.
**Touches:** `src/lib/integrations/zkbFeed.ts`, `src/lib/integrations/zkbFeed.md`, feed unit test.

On a failed seed, leave `state.cursor` as `null` so the next tick retries seeding, and never default to `0`. Emit a `warn` when the seed fails so the condition is visible in logs.

```ts
if (state.cursor === null) {
  const { status, body } = await fetchJson(`${BASE}/sequence.json`, signal);
  const parsed = sequenceSchema.safeParse(body);
  if (!parsed.success) {
    // Leave cursor null → re-seed next tick. Never fall back to 0: seq 1 has
    // long since aged out of the ephemeral feed, so a 0 cursor 404s on the
    // first walk step and wedges the feed dead (never re-seeds).
    jobLog.warn('zkb.seed_failed', { status });
    return { processed: 0, notified: 0, cursor: null };
  }
  state.cursor = parsed.data.sequence;
  return { processed: 0, notified: 0, cursor: state.cursor };
}
```

**Done when:** a failed `sequence.json` seed leaves the cursor `null` (verified by a unit test that seeds against a 500/malformed body and asserts the next successful tick still seeds live, not from 0), and the feed emits a `zkb.seed_failed` warn on the failure.

## Stage 2 — killmail freshness guard (phantom-flash fix)
**Mode:** Accept edits
**Goal:** Never flash a kill that zKB put into the live feed late; drop any decoded kill whose `killmail_time` is older than a small threshold before it can fan out.
**Touches:** `src/lib/integrations/zkb.ts` (`zkbKillSchema`), `src/lib/integrations/zkbFeed.ts`, both companions, feed unit test, `aperture.config.ts` (threshold constant).

The cursor is live, yet zKB reprocesses / accepts late-submitted killmails and appends them to the current R2Z2 sequence — the feed hands us a genuinely old kill through a healthy forward walk (see Log evidence §2: a 3-month-old Komo kill flashed). The correlation is "correct"; the kill is just stale. Gate on the ESI killmail time, which R2Z2 carries in its `esi` block.

1. Add `killmail_time` (ISO 8601 → `z.coerce.date()` or a string) to `zkbKillSchema` so `decodeKill` surfaces it. A missing/unparseable time is treated as stale (drop), not a crash.
2. Add a hard-coded `ZKB_FEED_MAX_KILL_AGE_MS` to `aperture.config.ts` (a few minutes — long enough to cover feed + processing latency, short enough that a reprocessed kill never qualifies).
3. In `pollOnce` (or a helper `isFresh(kill)`), skip any decoded kill older than the threshold **before** `correlateKill`, and emit `zkb.stale_skipped` (`killmailId`, `ageMs`) so drops are visible in logs the same way `zkb.notify` records flashes.

```ts
const kill = decodeKill(body);
if (!kill) continue;
const ageMs = Date.now() - kill.killmail_time.getTime();
if (ageMs > apertureConfig.ZKB_FEED_MAX_KILL_AGE_MS) {
  jobLog.info('zkb.stale_skipped', { killmailId: kill.killmail_id, ageMs });
  continue;
}
for (const load of correlateKill(kill, state.index)) { … }
```

**Done when:** a decoded kill whose `killmail_time` is older than `ZKB_FEED_MAX_KILL_AGE_MS` produces zero `systemNotification`s (unit test: feed one stale + one fresh kill in the same tick, assert only the fresh one notifies and the stale one logs `zkb.stale_skipped`), and a kill with a missing/invalid `killmail_time` is dropped rather than flashed.

> **Independence:** Stage 2 stands alone — it needs neither Stage 1 nor a live cursor to be correct, and it is the fix for the phantom flashes actually observed in prod. If only one stage ships first, ship this one.

## Notes

- The correlation path itself is sound — `correlateKill` sets `systemId = kill.solar_system_id` exactly, and the client matches `node.systemId === load.systemId` exactly. A flash always names the true kill system; the phantom is entirely the backfill above (or, separately, zKB's public site hiding a kill the live feed really did emit).
- Confirm which cause is live using the `zkb.notify` fan-out log: open a flashed kill's `href` and read its timestamp. Old kill ⇒ this backfill bug; recent kill ⇒ zKB-side.

## Log evidence (prod, 2026-07-05, ~2h window after an app restart at ~19:49 UTC)

Two distinct findings from the instrumentation on the live instance:

### 1. The cursor=0 backfill bug did NOT fire this boot — but the trigger window is visible

The seed request to `sequence.json` was rate-limited by zKB **11 consecutive times** at boot (`zkb.rate_limited`, attempts 1→11 over ~3.5 min, backoff capped at 30s), then recovered on the 12th attempt and seeded **live** (first notifies carry current killmail IDs ~136.8M, dated today). This is the *safe* path: a 429 throws `ZkbFeedRateLimitError` from `fetchJson` **before** the cursor is assigned, so the cursor stayed `null` through the storm and re-seeded cleanly.

But this proves the bug's trigger is mundane, not exotic: `sequence.json` is under heavy Cloudflare-fronted throttling at every boot. This boot got clean `429`s. A boot that instead gets a `403`/`503` HTML challenge page (which Cloudflare serves under heavier pressure) hits `!res.ok → { status, body: null }` → `safeParse(null)` fails → **`cursor = 0`** → sustained backfill. Same window, different status code. The planned fix (leave cursor `null`, never fall to 0) closes this.

### 2. A separate, real phantom-flash cause IS firing: zKB injecting stale kills into the live feed

Of 182 `zkb.notify` events, **175 are live** (killmail IDs 136804920→136808297, advancing with wall-clock). The other **7 fired in a single ~170ms tick** at `1783284378` (~20:45 UTC), all on map 2, all far below the live band:

| killmailId | systemId | verified date |
|---|---|---|
| 134704737 | 30031392 (Komo, Pochven) | **2026-04-12** — ~3 months old |
| 134704762, 134766543, 134766585 | 30031392 | old |
| 134793815, 134793836 | 30005005 | old |
| 136099723 | 30000192 | old (~700K below live) |

Cursor was live, so these came through the **normal forward walk** — zKB itself placed reprocessed / late-submitted killmails into the live R2Z2 sequence, which we faithfully fanned out. This is the "zKB-side" cause the note above anticipated, and it is the one **actually producing phantom flashes right now**. **The planned cursor fix does not address it.** Stopping these needs a freshness guard: skip a decoded kill whose killmail timestamp is older than a small threshold (e.g. a few minutes) before correlating. That requires the ESI killmail time, which R2Z2's `esi` block carries (`killmail_time`) — decode it in `zkbKillSchema` and gate in `correlateKill`/`pollOnce`.

### Operational health
No `zkb.fetch_error`, `zkb.decode_failed`, or `zkb.tick_failed` in the window — the feed is otherwise healthy; the only non-notify events were the boot rate-limit storm.
