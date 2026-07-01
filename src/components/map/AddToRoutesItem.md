## AddToRoutesItem

**Purpose:** "Add to routes" context menu item that saves a map system as a route-planner destination for the account.
**File:** `src/components/map/AddToRoutesItem.tsx`

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| system | MapSystemNode | yes | The map system to save as a route destination |
| onClose | () => void | yes | Called synchronously when the item is clicked |

### Renders
A single flat `MenuItem` (Route icon) labelled "Add to routes".

### Behaviour & Interactions
- On click, persists via `addRouteDestinationAction({ systemId })` and calls `onClose` synchronously (before the async call resolves).
- On success, publishes the saved row via `publishRouteDestination` so a mounted `RoutePlannerModule` folds it optimistically, and toasts `Added <alias|name> to routes`. Persisting through the Server Action means the destination is saved even when the route panel is hidden (unmounted).
- On failure the error toast is fired by `requestJson`/the action layer; no success toast fires.

### Emits / Calls
- `addRouteDestinationAction` (`@/app/(app)/actions/routes`)
- `publishRouteDestination` (`@/lib/map/routeDestinationBus`)

### Depends On
- `MenuItem` — `@/components/ui/menu`
