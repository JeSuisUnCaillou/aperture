## CurrentMapScopeSync

**Purpose:** Publishes the viewed map's ownership class into `CurrentMapScopeProvider` so header chrome (the Statistics dialog) can default to it.
**File:** `src/components/map/CurrentMapScopeSync.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| scope | ActivityStatScope | yes | The viewed map's ownership class (`ap_map.type`) |

### Renders
Nothing (`null`).

### Behaviour & Interactions
- On mount / when `scope` changes, writes it to the current-map-scope context; clears it (sets `null`) on unmount so leaving the map resets the default.

### Depends On
- `useSetCurrentMapScope` (`CurrentMapScopeContext`).
