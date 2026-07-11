## signatures/[sigId]/resolve-destination/route.ts

**Purpose:** Fold a wormhole type's fixed destination onto the map from the signature side.
**File:** `src/app/api/map/[mapId]/signatures/[sigId]/resolve-destination/route.ts`

---

### POST /api/map/[mapId]/signatures/[sigId]/resolve-destination
No request body. Calls `resolveSignatureDestination` (`src/lib/map/fixedDestination.ts`) and returns its `ActionResult<{ payloads, connectionId }>` (wrapper-level `eventId` is `0`; `payloads` are the per-row committed events for the client to fold + dedupe, `connectionId` is the ensured/existing `ap_map_connection.id` the client links the sig to). `[sigId]` is `ap_map_signature.id`, not the in-game code.

**Access:** `requireMapMutate(…, 'map_update')` — a content edit (placing a node + connection). The destination is read server-side from the sig's type's `universe_wormhole.target_system_id`, so a client can't force a resolve from a non-pinned hole.
