## WormholeTypeSelect

**Purpose:** Class-aware wormhole-type dropdown for the signature inspector — short by default, with a "show all" escape hatch.
**File:** `src/components/sidebar/WormholeTypeSelect.tsx`

### Props
| Prop | Type | Required | Description |
|---|---|---|---|
| systemSecurity | string \| null | yes | Host system's class label (`MapSystemNode.security`); drives `matchesClass`. |
| staticTypeIds | number[] | yes | Host system's static `universe_wormhole.type_id` set (`MapSystemNode.staticTypeIds`); drives `isStatic`. |
| value | number \| null | yes | Selected `universe_wormhole.type_id`, or null when unset. |
| onValueChange | (next: number \| null) => void | yes | Fires when the user picks a different option. |
| disabled | boolean | no | Disables the trigger. |
| destinationClass | string \| null | no | The bound leads-to connection's far-end class label. When set, back-filters the list to types whose `targetClass` matches it; null/absent = no destination constraint. |
| triggerClassName | string | no | Merged onto the `SelectTrigger` (via `cn`) — used by `SignatureModule` to flatten the pill styling in-table. |

### Renders
A `Select` populated with WH codes (e.g. "A239", "K162"). Each option uses a flex `justify-between` layout: WH name on the left, destination on the right, rendered bold and color-coded via `systemClassColor(targetClass)` — the same palette the map uses for system-node statics. The destination text is the target **class** label for a normal hole, but a fixed-destination hole (J377 → Turnur, the Thera and Drifter holes) shows its pinned **system name**; Drifter systems resolve to their community short name (Barbican, Conflux, …) via `systemDisplayName`. Colour stays keyed off `targetClass` so Turnur reads as low-sec orange. The closed trigger mirrors this layout (name left, color-coded destination pushed to the right edge) via a `SelectValue` render function given `flex-1` so it stretches the full trigger width. The first item is a sentinel "Select type…" that maps to `null`.

Layout follows the device-local `wormholePickerPrefs` (`grouped`), subscribed live via `useSyncExternalStore`.

**Grouped mode** (`grouped`, default) — options are partitioned via `partitionWormholeOptions` into titled sections separated by dividers, each keeping the catalog's alphabetical order:
- **Statics** (`isStatic`) — the system's statics, pinned first.
- **K162's** — the canonical inbound exit hole.
- **Potential wandering** — class-matched, non-static, non-frig, non-edge holes.
- **Frig holes** — class-matched frigate-sized holes (`jumpMassClass === 's'`).
- **Edge cases** — class-matched holes leading to Thera (`C12`) or Pochven (`P`).
- **Others** — every catalog hole not shown in the default sections above, hidden behind a `Show all types (+N)` / `Show fewer` toggle button at the foot of the list (a plain `<button>`, not a `SelectItem`, so clicking it expands the group without selecting or dismissing the popup). This is the escape-hatch complement: it holds the class-implausible holes (`!matchesClass`) plus, when a `destinationClass` narrows the default sections, the holes that don't open onto that class — so the fallback always reaches literally every type regardless of the destination constraint.

The Potential-wandering and Frig-hole sections order their options by destination class (via `subgroupByClass`) so same-class holes cluster together; the per-row color-coded class label carries the class, so no per-class sub-header is drawn.

**Alphabetical mode** (`!grouped`) — a single flat list of every catalog option in name order, no section headers and no "show all" split.

Option rows and the popup are vertically compacted (`py-1` items, `p-0.5` content) to fit the dense Signatures module.

### Behaviour & Interactions
- On mount, calls `fetchWormholeCatalog()` — the static catalog is fetched **once per session** and shared by every dropdown (no per-system fetch). The component then derives this system's options with `annotateWormholeTypes(catalog, { security, staticTypeIds })` in a `useMemo`.
- **Destination back-filter:** when `destinationClass` is set (the far-end class of a bound leads-to connection), only the **default-visible sections** are narrowed to types whose `targetClass` equals it — plus any null-target hole (`K162` and the like) that resolves from the far side, and the current `value` (so a mismatched existing selection still renders in its section). The `others`/`Show all` fallback is left unconstrained, so the full catalog stays reachable. This is the reverse of `ConnectionSelect`'s type→leads-to filter, so the two stay mutually consistent whichever side is set first. Alphabetical mode renders the full unfiltered list (its own escape hatch), so the back-filter applies to grouped mode only.
- Subscribes to `wormholePickerPrefs` via `useSyncExternalStore`; a toggle flipped in Map Settings re-renders every open picker live.
- `showAll` (local) gates the "others" group; collapsed by default. The parent re-mount also resets this naturally.
- Disables itself during the initial load.
- Treats the sentinel value `__none__` as null in both directions.

### Module-level helpers
- `destinationLabel(opt)` — the right-hand destination text: the Drifter short name / pinned system name for a fixed-destination hole (via `systemDisplayName`), else `opt.targetClass`.
- `OptionDivider` — thin `<div>` that renders the horizontal separator between groups; declared at module scope (not inside the component) to satisfy the `react-hooks/static-components` rule.
- `GroupHeader` — the uppercase muted section-title row; module scope for the same rule.

### Depends On
- `Select*` from `@/components/ui/select`
- `fetchWormholeCatalog` from `@/lib/map/client`
- `annotateWormholeTypes`, `partitionWormholeOptions`, `subgroupByClass`, `WormholeCatalogEntry` from `@/lib/map/wormholeCatalog`
- `readWhPickerPrefs`, `getServerWhPickerPrefs`, `subscribeWhPickerPrefs` from `@/lib/wormholePickerPrefs`
- `systemClassColor` from `@/components/map/styling` — destination-class color coding
- `systemDisplayName` from `@/lib/eve/drifterSystems` — Drifter short name for a pinned destination
- `WormholeTypeOption` from `@/types`
