## routeDestinationBus.ts

**Purpose:** In-process client pub/sub (routes-module) bridging the map context-menu "Add to routes" action to a mounted `RoutePlannerModule`, so a saved destination folds into the panel without a navigation reload.
**File:** `src/lib/map/routeDestinationBus.ts`

---

### publishRouteDestination(dest: RouteDestinationView): void
Broadcasts a newly-saved route destination to every current subscriber.

**Parameters:**
- `dest` — the saved destination joined to its system display fields.

---

### subscribeRouteDestinations(cb: (dest: RouteDestinationView) => void): () => void
Registers a listener for route-destination additions.

**Returns:** An unsubscribe function that removes the listener.
