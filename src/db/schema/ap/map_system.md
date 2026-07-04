## map_system.ts

**Purpose:** The `ap_map_system` table — a system node placed on a map, referencing static `universe_system`.
**File:** `src/db/schema/ap/map_system.ts`

---

### apMapSystem
`pgTable('ap_map_system', …)`:
- `id` — `bigserial` PK.
- `map_id` — `bigint` FK → `ap_map.id` `ON DELETE CASCADE`.
- `system_id` — `integer` FK → `universe_system.id` `ON DELETE RESTRICT` (a static system in use must not be deletable).
- `visible` — `boolean`, required. **Lifecycle flag**: removing a system flips this `false` (row persists); re-adding upserts `true`. `MAX_SYSTEMS` counts only `visible = true`.
- `position_x` / `position_y` — `double precision`, default `0`. No coordinate clamping.
- `alias`, `tag`, `intel_notes` — `text`, nullable.
- `status` — `system_status` enum, default `unknown`.
- `locked` — `boolean`, default `false`.
- `locked_by_character_id` — `bigint` FK → `ap_character.id` `ON DELETE SET NULL`, nullable (migration 0050). The current lock holder: stamped when `locked` flips true, NULLed when it flips false. Resolved to a name at load and carried on the realtime payload so the inspector shows who locked the system.
- `rally_at` — `timestamptz`, nullable. Non-null ⇒ rally active.
- `first_added_at` / `last_visible_at` / `updated_at` — `timestamptz`, default `now()`.

**Unique:** `(map_id, system_id)` — one node per system per map (`ap_map_system_map_system_uq`).
