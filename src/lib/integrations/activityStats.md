## activityStats.ts

**Purpose:** Per-character activity projection over `ap_activity_rollup`, scoped to one integration token's corporation — backs `POST /api/integrations/activity-stats`.
**File:** `src/lib/integrations/activityStats.ts`

---

### Types
- `IntegrationActivityBucket` — `{ bucketStart, system, connection, signature }`; the three groups are `ActivityTriplet` (`src/lib/stats/activityShaping.ts`).
- `IntegrationCharacterActivity` — `{ characterId, buckets }`.
- `IntegrationActivityStatsResponse` — `{ generatedAt, granularity, coverage: { earliest, latest }, characters }`.

These are re-exported from `src/types/index.ts`.

---

### loadIntegrationActivityStats({ corporationId, characterIds, from?, to?, granularity }): Promise<IntegrationActivityStatsResponse>
Loads activity for `characterIds`, scoped strictly to `corporationId`'s `type='corp'`, non-deleted maps — the tenant boundary a token can never see past. No maps in scope → every requested character gets `buckets: []` and `coverage` is `{ earliest: null, latest: null }`.

- **Raw `character_id`, not main-collapsed** — unlike `loadActivityStats`, does not join `ap_character`/`ap_user` or attribute to an account main; consumers own their own alt-identity graph.
- **Caller-defined window** — `to` defaults to today (UTC); `from` omitted means unbounded (from the earliest rollup data). Both are inclusive.
- Buckets by `weekly` (Monday of the ISO week, UTC) or `daily` period via the shared `bucketStart`/`KIND_MAP`/`activityKindExclusion` (`src/lib/stats/activityShaping.ts`) — same `map.%`/`system.moved` exclusions as the UI reader.
- **Only non-empty buckets are emitted**, sorted oldest → newest.
- `coverage` is the min/max rollup `day` across the corp's in-scope maps (not global Aperture data).
- Every id in `characterIds` appears in `characters`, in request order — a quiet character is `buckets: []`, never omitted.
