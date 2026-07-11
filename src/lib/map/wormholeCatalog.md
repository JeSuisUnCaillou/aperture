## wormholeCatalog.ts

**Purpose:** Client-safe wormhole-catalog types + per-system annotation; lets the dropdown derive class grouping locally instead of re-fetching the catalog per system.
**File:** `src/lib/map/wormholeCatalog.ts`

No `import 'server-only'` — imported by client components. The DB read producing the catalog lives in `wormholeTypes.ts` (`wormholeCatalog()`).

---

### type WormholeCatalogEntry
One immutable catalog row, identical for every system: `typeId`, `name`, `sourceClasses` (`string[] | null`), `targetClass` (`string | null`), `targetSystemId` / `targetSystemName` (`number | null` / `string | null` — fixed destination of a pinned hole like J377 → Turnur; null for normal holes), `jumpMassClass` (`WhJumpMass | null`).

### type WormholeTypeOption
`WormholeCatalogEntry` plus the two per-system flags `isStatic` and `matchesClass`. Produced by `annotateWormholeTypes`.

### type WormholeGroups
The picker's semantic buckets for one system: `statics`, `k162`, `wandering`, `frig`, `edge` (Thera/Pochven-target), `others` (`!matchesClass`, gated behind the picker's "show all"). Each array keeps the catalog's alphabetical order.

### type WormholeClassSubgroup
`{ classLabel: string | null; options: WormholeTypeOption[] }` — a cluster of options sharing a destination class, for sub-header rendering.

### EDGE_TARGET_CLASSES
`Set` of destination class labels that form the "edge case" group: `C12` (Thera), `P` (Pochven).

---

### jumpMassBand(kg: number | null): WhJumpMass | null
Buckets a wormhole's `wormholeMaxJumpMass` (kg) into the `s`/`m`/`l`/`xl` connection size bands. Thresholds: `≤5M → s`, `≤100M → m`, `<1B → l`, `≥1B → xl` (chosen to sit in the gaps between EVE's discrete jump-mass values — 5M / 62M / 300M·375M / 1B+). `null` in → `null` out. Client-safe, so both the server catalog read (`wormholeTypes.ts`) and client popovers (resolving a static/connection size from a reference `jumpMass`) share one derivation.

---

### annotateWormholeTypes(catalog: WormholeCatalogEntry[], system: { security: string | null; staticTypeIds: number[] }): WormholeTypeOption[]
Pure function. Tags each catalog entry with `isStatic` (entry's `typeId` is in the system's static set) and `matchesClass` (`sourceClasses == null`, or contains `system.security`, or `isStatic`). The static clause keeps a shattered system's odd-class statics visible by default.

**Parameters:**
- `catalog` — the full static catalog (fetched once via `fetchWormholeCatalog`).
- `system.security` — the host system's class label (`MapSystemNode.security`).
- `system.staticTypeIds` — the host system's static `universe_wormhole.type_id` set (`MapSystemNode.staticTypeIds`).

**Returns:** The catalog annotated for that system, preserving input order.

---

### partitionWormholeOptions(options: WormholeTypeOption[]): WormholeGroups
Pure single-pass partition of annotated options into `WormholeGroups`, preserving alphabetical order within each bucket. Classification precedence per option: static → K162 → non-matching (`others`) → edge target (`EDGE_TARGET_CLASSES`) → frigate (`jumpMassClass === 's'`) → wandering.

---

### subgroupByClass(options: WormholeTypeOption[]): WormholeClassSubgroup[]
Clusters options by `targetClass` so the picker can order same-class holes together. Clusters are ordered wormhole-classes-first (C1–C6, then k-space and special destinations); unlisted classes and `null` sort last. Alphabetical order is preserved within each cluster.
