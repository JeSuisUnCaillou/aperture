## placement.ts

**Purpose:** Pure, framework-free geometry for placing map nodes on a snapped grid without overlapping existing ones; shared by server jobs, server actions, and the client map.
**File:** `src/lib/map/placement.ts`

No `server-only`, React, or DB imports — runs anywhere and is unit-testable in isolation.

---

### Constants
- `GRID_SIZE = 10` — snap granularity.
- `NODE_WIDTH = 145`, `NODE_HEIGHT = 45` — collision footprint of a system node; every slot must exceed it so drops never overlap.
- `AUTO_SLOT = { x: 230, y: 70 }` — auto-placement exclusion half-extent (center-to-center minimum); generous on x so auto-placed chains fan out with clear horizontal spacing. The default slot.
- `MANUAL_SLOT = { x: 160, y: 60 }` — manual-drag exclusion half-extent; tighter than auto on both axes so a user can pack a chain closer by hand. Grid-aligned and still larger than the node footprint.
- `SLOT_X = 170`, `SLOT_Y = 70` — the `AUTO_SLOT` components as scalars (deprecated; prefer `AUTO_SLOT.x`/`.y`).

### Types
- `Point = { x: number; y: number }` — top-left coordinate.
- `Rect = Point` — alias; width/height implied by the constants.
- `Slot = { x: number; y: number }` — a node exclusion-zone half-extent on each axis.

These are geometry primitives, not domain types — intentionally local to this module (not in `src/types/index.ts`).

---

### snapToGrid(p: Point): Point
Rounds `p` to the nearest `GRID_SIZE` on both axes.

---

### overlaps(a: Point, b: Point, slot?: Slot): boolean
True when two top-left points sit closer than `slot` on both axes (footprint + gap collision). `slot` defaults to `AUTO_SLOT`; pass `MANUAL_SLOT` for the tighter manual-drag threshold.

---

### findOpenPosition(anchor: Point, occupied: Point[], slot?: Slot): Point
Snaps `anchor`; if that slot is clear, returns it. Otherwise returns the **exact nearest** grid-aligned point that overlaps nothing in `occupied` — the minimal nudge out of the collision, in whatever direction is actually closest (no fixed bias, no big spiral leap).

Treats the free space as the plane minus one exclusion rectangle (half-extent `slot`) per occupied node. The nearest free point's coordinates are provably constrained to `xs × ys` where `xs = {anchor.x} ∪ {o.x ± slot.x}` and `ys = {anchor.y} ∪ {o.y ± slot.y}` over all blockers — each axis either stays at the drop (sliding straight off an edge) or pins to a blocker's edge, and cross-blocker corners fall out of the product. It scans that small set and keeps the nearest open one. The point beyond the rightmost blocker is always open, so a result always exists. Ties prefer below/right so growth reads naturally.

**Parameters:**
- `anchor` — desired location (e.g. a parent system's position, the viewport centre, or a drag drop point).
- `occupied` — top-left points of all currently-placed nodes.
- `slot` — exclusion half-extent to enforce; defaults to `AUTO_SLOT`, `MANUAL_SLOT` for manual drags.

**Returns:** The grid-aligned `Point` nearest `anchor` that does not `overlaps` any member of `occupied` at the given `slot`.

Generalises the ad-hoc fan layout in `thera.ts` (`hubBasePosition` + the fan loop); Thera's `HUB_GROUP_SPACING`/`TARGET_FAN_RADIUS` could optionally re-point at these constants later.
