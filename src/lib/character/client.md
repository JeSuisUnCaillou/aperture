## client.ts

**Purpose:** Browser-side helpers for character-scoped side-effect actions that touch the EVE client via ESI (not map mutations). Errors surface as toasts through `requestJson`; callers branch only on `ok`.
**File:** `src/lib/character/client.ts`

---

### setWaypointOnServer(args: { characterId: number; destinationId: number }): Promise<{ ok: true } | { ok: false; error: string }>
Sets `destinationId` (an EVE solar-system id) as the autopilot destination on the given character's in-game route, clearing any existing waypoints. Thin wrapper over `requestJson('POST', '/api/character/waypoint', args)`. Backs the map's "Set destination" context-menu action (`MapContextMenu`). The character must belong to the signed-in user (enforced server-side). On failure `requestJson` already toasts the error.

### Depends On
- `@/lib/http/fetchJson` — `requestJson`.
