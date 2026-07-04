## CurrentMapScopeContext

**Purpose:** Client context that publishes the currently-viewed map's ownership class (private/corp/alliance) to header chrome outside the map page.
**File:** `src/components/chrome/CurrentMapScopeContext.tsx`

---

### CurrentMapScopeProvider({ children })
Holds the current map scope state. Mounted in the app layout so it spans both the header and the map view (which are siblings). Defaults the scope to `null`.

### useCurrentMapScope(): ActivityStatScope | null
The current map's scope, or `null` when no map is being viewed (or outside the provider).

### useSetCurrentMapScope(): (scope: ActivityStatScope | null) => void
Setter for the current map scope. Returns a no-op when called outside the provider. Used by `CurrentMapScopeSync` in the map page.
