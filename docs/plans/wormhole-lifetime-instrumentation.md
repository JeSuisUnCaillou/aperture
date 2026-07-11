# Wormhole Lifetime Instrumentation

**Goal:** Capture enough at connection death that wormhole lifetime can be measured (natural vs rolled, collapse time vs clear time) with a single query, instead of being forensically reconstructed from raw events.

**References:**
- `src/db/schema/ap/map_connection.md` (`eol_stage`, `eol_at`, `confirmed_at`, `mass_status`, `is_rolling`, `created_at`; hard-deleted on collapse)
- `src/db/schema/ap/map_connection_log.md` (per-jump alive-pings; **ON DELETE CASCADE** with the connection)
- `src/db/schema/ap/map_event.md`, `src/db/schema/ap/event_kind.md` (`connection.delete`, jsonb payload)
- `src/lib/jobs/tasks/eolExpiry.md`, `src/lib/jobs/tasks/expiredConnections.md` (the two reaper crons)
- `src/lib/map/connectionMassLog.md`, `src/lib/jobs/tasks/locationPoll.md` (the passive alive-ping source)
- `src/lib/map/mutations/` (manual connection delete + `removeSystem` cascade paths)
- `aperture.config.ts` (`WORMHOLE_DEFAULT_LIFETIME_MS` = 48h, `WORMHOLE_EOL_LIFETIME_MS` = 4h15m, `WORMHOLE_EOL_CRITICAL_LIFETIME_MS` = 1h15m)
- CLAUDE.md: history lives in `ap_map_event` (no parallel audit table); exactly one `INSERT INTO ap_map_event` per mutation; new domain types go in `src/types/index.ts`.

---

## The measurement problem this fixes

The J160941 static study could only report lifetime as "time until a human cleared the hole." Two error sources fell out of that:

1. **Clear-lag.** A hole collapses in-game at T and is cleared at T+lag. Observed lifetime overcounts by the lag. This produced the only apparent over-runs (O477 to 17.4h, B274 to 26.2h), which are really "nobody deleted it yet," not "it stayed open."
2. **Stale abandonment.** 56 home holes were never EOL-flagged and rotted until the blind 48h `expiredConnections` cap swept them. At 48h they are physically impossible lifetimes, so they carry no lifetime signal at all, yet they had to be filtered out by hand.

On top of that, most young deaths are **rolled** holes (deliberate mass-collapse), which are not a lifetime signal but currently look identical to natural collapse in the event log.

**The binding constraint:** on collapse the connection row and its mass-log both vanish (cascade). So `ap_map_event` is the sole durable record. Every fact below must be written into the `connection.delete` event *at delete time*, read from the connection and its log inside the deleting transaction. Nothing can be recovered afterward.

### Signals already collected today

| Signal | Where it lives | Survives collapse? |
|---|---|---|
| Birth time | `ap_map_connection.created_at`, and the `connection.create` event | Event: yes |
| Last tracked jump ("alive at T") | `ap_map_connection_log.jumped_at` | **No, cascades away** |
| Last sig re-observation | `ap_map_connection.confirmed_at` | **No** |
| Mass state / rolled | `ap_map_connection.mass_status`, `is_rolling` | **No** |
| EOL stage + when entered | `ap_map_connection.eol_stage`, `eol_at` | **No** |
| Endpoint systems | already in the `connection.delete` payload | Yes |

Everything in the "No" rows is exactly what Stage 1 rescues into the delete event.

---

## Stage 1 — Typed cause + death snapshot on `connection.delete`
**Mode:** Plan mode
**Goal:** Make every `connection.delete` event carry *why* the hole died and a snapshot of its state at death, so cause-of-death becomes a field rather than a reconstruction.
**Touches:** `src/types/index.ts` (a `ConnectionDeathCause` union + the enriched delete-payload type), the `connection.delete` payload builder / `commitMapEvent` call sites: `src/lib/jobs/tasks/eolExpiry.ts`, `src/lib/jobs/tasks/expiredConnections.ts`, the manual delete mutation and the `removeSystem` cascade in `src/lib/map/mutations/`. Their companion `.md` files. No schema migration (payload is jsonb; `event_kind` is unchanged).

**Design decisions to settle in this stage:**
- **Cause union.** Proposed: `manual_removed` (user deleted), `rolled` (removed while `is_rolling` or mass-critical), `eol_reaped` (eolExpiry cron), `expired_swept` (expiredConnections 48h cap), `endpoint_removed` (`removeSystem` cascade). Each delete site sets exactly one.
- **Death snapshot fields** to add to the payload: `bornAt` (connection `created_at`), `lastAliveAt`, `massStatus`, `isRolling`, `eolStage`, `eolAt`.
- **`lastAliveAt` derivation.** Because the mass-log cascades, the deleting transaction must read it before/as it deletes. Use `greatest(max(ap_map_connection_log.jumped_at), confirmed_at, updated_at)` as the best available "known open at" timestamp. This is what bounds clear-lag: true collapse lies in `[lastAliveAt, deletedAt]`. It is a lower bound only (untracked jumps and scanner sightings do not ping it; Stage 3 widens it).
- **Cron delete shape.** Both reapers currently delete-with-`RETURNING` the endpoint ids. They will need a pre-select or a CTE so the snapshot (including the mass-log max) is captured in the same statement/txn.

**Done when:** every one of the delete sites emits a `connection.delete` whose payload includes a correct `cause` and the death snapshot; an integration test asserts the cause per site (a cron sweep tags `eol_reaped` / `expired_swept`, a user delete tags `manual_removed`, a rolled connection tags `rolled`, an endpoint removal tags `endpoint_removed`); build/lint/typecheck green.

---

## Stage 2 — Connection-lifecycle read model
**Mode:** Accept edits
**Goal:** One durable, queryable object that pairs each `connection.create` with its `connection.delete` and exposes born/died/lifetime/cause/last-alive/rolled, replacing the session-local `home_wh_life` / `conn_static` temp views.
**Touches:** a new SQL view (or a `src/lib/map/` query builder) over `ap_map_event`, its companion `.md`, and a short doc note in `src/app/api/map/README.md` or the schema index pointing at it. No new table (CLAUDE.md: history lives in `ap_map_event`, no parallel audit table). If a materialized form is wanted later for speed, it derives from the events and is refreshed, never dual-written.

**Shape (per connection):** `connection_id`, `map_id`, `source/target system`, `wormhole_code` (joined from the sig events as the study did), `born_at`, `died_at`, `lifetime_h`, `cause`, `last_alive_at`, `clear_lag_h` (= `died_at - last_alive_at`), `mass_status_at_death`, `was_rolled`, `eol_stage_at_death`, `eol_at`.

**Done when:** a single `SELECT ... WHERE map_id = ? AND wormhole_code IN ('O477','B274')` reproduces the study's cohorts (observed / eol_reaped / expired_swept / rolled) with no hand-written CTEs, and `clear_lag_h` is populated for holes that had at least one alive-ping.

---

## Stage 3 — Continuous alive heartbeat on scan re-observation
**Mode:** Plan mode
**Goal:** Widen `last_alive_at` beyond tracked-character jumps so holes nobody jumps but scanners keep seeing still get a fresh "known open at" stamp, tightening the clear-lag bound.
**Touches:** the signature paste / re-observation path that owns `confirmed_at`; verify it bumps `confirmed_at` every time a paste re-lists an existing connection's sig (today it is stamped at create and by some paths but is not a guaranteed per-scan heartbeat). Companion `.md` updates.
**Done when:** re-pasting a scan that still contains a mapped connection's signature advances its `confirmed_at`, and that value flows into Stage 1's `lastAliveAt` derivation.

---

## Stage 4 — Age-based auto-EOL marking
**Mode:** Plan mode
**Goal:** Mark a wormhole `eol_stage = 'eol'` automatically as it approaches its type's catalogued lifetime, so abandoned holes get reaped by `eolExpiry` near nominal instead of rotting to the 48h `expiredConnections` cap. This is what kills the stale pile at the source.
**Touches:** a new cron task under `src/lib/jobs/tasks/` (+ registry + companion), reading the per-type nominal lifetime via the static catalog (`staticMatchForConnection` / `src/db/schema/universe/statics.ts`) against connection age.
**Key design risk to resolve in plan mode:** an age-based EOL is a *guess* about collapse, not an observation. It must be distinguishable from a human/observed EOL (for example an `eol_source` marker of `auto` vs `observed` carried through to the death snapshot) so the lifecycle read model can exclude auto-marked holes from any "how long do they really last" measurement. Getting this wrong launders guesses into the dataset as data, which is the exact failure this whole effort is trying to prevent.
**Done when:** a stale wh connection past its type nominal is auto-marked `eol` with `eol_source = 'auto'`, `eolExpiry` reaps it near nominal rather than at 48h, and Stage 2's read model can filter auto-EOL holes out of lifetime stats.

---

## Stage 5 (optional) — Clean measurement run
**Mode:** Plan mode
**Goal:** With the instrumentation above in place, run a deliberate lifetime experiment rather than another opportunistic reconstruction.
**Approach:** tag a set of home statics, leave rolling off on them, let them run to natural collapse, and lean on `last_alive_at` plus the typed `cause` to timestamp and classify each death. Consider tiering the `expiredConnections` cap nearer nominal-plus-margin for the tagged set so junk is pruned sooner (but only after Stage 3, since a tighter cap without better alive-detection risks deleting a genuinely-open, uncleared hole).
**Done when:** the read model yields a natural-collapse-only distribution for O477/B274 with clear-lag bounded per hole, good enough to state a real over-run figure rather than an upper bound.

---

## Sequencing notes

- Stage 1 is load-bearing: Stages 2 to 5 all read the death snapshot it writes. Do it first and get the cause taxonomy right.
- Stages 2 and 3 are independent of each other and can be done in either order after Stage 1.
- Stage 4 is the largest behavioral change and the one most able to corrupt the dataset if the auto/observed distinction is sloppy; keep it behind Stage 2 so its output is immediately inspectable.
