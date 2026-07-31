# Phantom wormholes from a stale location snapshot

**Goal:** Stop the location-poll inventing wormhole connections between k-space systems that are a short gate trip apart, when the poll's "from" endpoint is too old to be trusted.
**References:** `src/lib/map/locationToConnection.ts` (`classifyJump`), `src/lib/jobs/locationCommit.ts`, `src/db/schema/ap/character.ts` (`last_system_id`, `last_location_at`), `aperture.config.ts` (`LOCATION_POLL_ONLINE_MS`, `LOCATION_POLL_OFFLINE_MS`).

Investigated 2026-07-31 against the live corp instance (map 1, 47 days of `ap_map_event`). Not yet fixed.

## The bug

`classifyJump` decides wormhole-vs-gate on a single `EXISTS` against `universe_stargate_edge`, which tests **direct** adjacency only. A transition between two systems that are 2+ gate jumps apart is not adjacent, so unless the pilot arrived docked it falls through to `'wormhole'` and `locationCommit` folds both endpoints onto the map plus a `scope='wh'` connection between them.

That is correct when the two observations really are consecutive. It is wrong when the poll's stored "from" is stale, because the pilot can have made several gate jumps in the gap. Two things make the gap real:

- `last_system_id` is frozen while a character is offline. Offline ticks update only `last_online` (`character.md`), so the cached location can be arbitrarily old.
- The offline cadence is `LOCATION_POLL_OFFLINE_MS` (60s), so the first location fetch after a character comes back online can trail the actual login by up to a minute. Two gate jumps in a minute is routine.

The classifier cannot tell "one wormhole jump" from "two gate jumps I did not observe", so it picks wormhole.

## Evidence

Map 1 draws a recurring highsec-to-highsec "wormhole" between **Pakhshi** and **Kassigainen**. They are not adjacent; both are gate-adjacent to Synchelle, putting them exactly 2 jumps apart.

- 89 occurrences in 47 days, both directions (55 Kassigainen to Pakhshi, 34 the reverse), across 38 distinct characters. One pilot (Lesican, including an alt on the same account) accounts for 33 of them.
- **88.8%** of these folds had no map activity from the acting pilot in the previous 10 minutes, against **28.7%** for genuine wormhole folds. They are cold starts, not pilots working a chain.
- Both endpoints are inserted within ~20ms of each other and then linked, so neither system was on the map: the pilot appears out of nowhere.
- Every *other* k-space pair within 2 gate jumps that got a `wh` link occurred exactly once (about 10 pairs). This pair is the entire repeat population, consistent with it being a corridor pilots fly right after logging in.
- Synchelle, the system between them, has been added to the map once ever. Correctly-tracked gate travel writes nothing, so only the skipped traversals leave a trace.

Cost: roughly 205 junk `system.added` and 89 junk `connection.create` events, and the phantom link survives a median of 69 minutes before someone deletes it. It also makes Pakhshi and Kassigainen the two most-encountered systems in the entire dataset, which corrupts any per-system statistics built on `system.added`.

## Fix direction

**Do not widen the adjacency probe to 2 hops.** A real wormhole between two systems that happen to be 2 gate jumps apart is perfectly possible, so a 2-hop rule would start silently dropping genuine holes, and a longer stale window still lets a 3-hop move through. It treats the symptom (the topology looks odd) rather than the defect (the "from" endpoint is not trustworthy).

Guard on freshness instead. When `now() - last_location_at` exceeds a small multiple of `LOCATION_POLL_ONLINE_MS`, the poll should treat the new location as a re-baseline: write `last_system_id` / `last_location_at` and fold nothing onto the map. A traversal cannot be inferred from two observations with a known gap between them. This also covers the one-off phantom pairs on other routes, and loses no real wormholes: a genuine hole jump missed by one stale tick is re-derivable from the next real jump, or gets scanned in as a signature.

Open question for whoever picks this up: the exact staleness threshold, and whether the offline-to-online transition should force a re-baseline unconditionally rather than relying on a time comparison.
