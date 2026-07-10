## statics.ts

**Purpose:** Drizzle tables for community-compounded wormhole data — per-system static spawns and the wormhole-type routing catalog.
**File:** `src/db/schema/universe/statics.ts`

---

### universeSystemStatic
`universe_system_static`. PK `(system_id, type_id)`, both CASCADE FKs. Maps each J-space system to the wormhole type(s) that always re-spawn there. Hand-maintained in vendored `scripts/data/system-static.csv` (seeded from anoik.is, which is frozen; WH statics are not in the official SDE).

### universeWormhole
`universe_wormhole`. PK `type_id` → `universe_type.id` CASCADE. Wormhole-type routing catalog, hand-maintained in `scripts/data/wormhole-classes.csv` (seeded from anoik.is, which is frozen; new types are hand-added as CCP ships them).

| Column | Type | Notes |
|---|---|---|
| type_id | int PK | FK → universe_type, CASCADE |
| name | text NOT NULL | WH code, e.g. `A239`, `K162` |
| source_classes | text[] | set of classes it can spawn in (`C1`–`C6`, `C12` Thera, `C13` shattered, `H`, `L`, `0.0`); same vocabulary as `universe_system.security` (`deriveSecurityLabel`) — Thera is `C12`, not the literal `Thera`. e.g. S199 = `{L, 0.0}`. `null` = anoik leaves source unspecified |
| target_class | text | class it leads into; `null` = unknown / unmodeled (K162, Drifter destinations) |
| target_system_id | int | FK → `universe_system` **RESTRICT**, nullable; the exact far-end system for fixed-destination holes (e.g. J377 → Turnur); `null` for normal holes whose destination is unknown until scanned |

- Class-only catalog for mass/lifetime/scan-strength, which stay dogma-sourced (`universe_type_attribute` + `universe_type_override` via the effective view); this table vendors the navigationally-missing source/target class labels, plus `target_system_id` for the holes that pin one specific destination (migration 0054).
- `target_system_id` refines `target_class`, it does not replace it: a J377 carries both `target_class = L` and `target_system_id = Turnur`, and both stay true. Set only for fixed-destination types.
- `source_classes` is a Postgres `text[]`: a hole can spawn in several classes (e.g. `S199 = {L, 0.0}`, `R943 = {H, L, 0.0}`). The five Drifter holes (`B735`/`C414`/`R259`/`S877`/`V928`) carry `{H, L, 0.0}` — they spawn only in k-space systems with a Jove Observatory, which isn't determinable from the SDE, so they're broadened to the full k-space set rather than left null (keeps them out of the J-space default suggestions). `null` = anoik leaves the source unspecified — the universal `K162` reverse-exit **plus** the shattered-access holes (e.g. `A009`) whose source class falls outside Aperture's vocabulary. Class-filter queries treat null source as "always offer".
- `K162` is the universal reverse-exit: `source_classes = null` (appears anywhere), `target_class = null` (resolved from the far side).
- Hand-maintained in vendored `scripts/data/wormhole-classes.csv` (`code;sourceClasses;targetClass`, `sourceClasses` `|`-joined); the CSV, not anoik.is, is the source of truth.
