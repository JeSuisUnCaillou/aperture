// Pure geometry for non-overlapping, grid-aligned node placement. No server-only,
// React, or DB imports — this runs in jobs, server actions, and the browser, and is
// unit-testable in isolation.

/** Snap granularity for all placement. */
export const GRID_SIZE = 10;
/** Collision footprint of a system node: `min-w-36`≈144px plus the optional statics line and a margin. */
export const NODE_WIDTH = 145;
export const NODE_HEIGHT = 45;
/** A node exclusion-zone half-extent on each axis (a top-left within one on both axes overlaps). */
export type Slot = { x: number; y: number };

/**
 * Auto-placement exclusion half-extent (center-to-center minimum). Generous on x so
 * automatically-placed chains fan out with clear horizontal spacing. The default slot.
 */
export const AUTO_SLOT: Slot = { x: 230, y: 70 };

/**
 * Manual-drag exclusion half-extent — tighter than auto on both axes so a user can pack a
 * chain closer by hand. Both values still exceed the node footprint (145×45) and are grid
 * multiples, so drops never overlap and stay grid-aligned.
 */
export const MANUAL_SLOT: Slot = { x: 160, y: 60 };

/** @deprecated Prefer `AUTO_SLOT.x`. Retained as the auto-placement half-extent. */
export const SLOT_X = AUTO_SLOT.x; // 230
export const SLOT_Y = AUTO_SLOT.y; // 70

export type Point = { x: number; y: number };
/** A placed node's top-left corner; width/height are implied by the constants above. */
export type Rect = Point;

export function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
  };
}

/** True when two top-left points sit closer than one `slot` (footprint+gap) on both axes. */
export function overlaps(a: Point, b: Point, slot: Slot = AUTO_SLOT): boolean {
  return Math.abs(a.x - b.x) < slot.x && Math.abs(a.y - b.y) < slot.y;
}

function isOpen(candidate: Point, occupied: Point[], slot: Slot): boolean {
  return !occupied.some((o) => overlaps(candidate, o, slot));
}

/** Nearest to `base` first; ties prefer larger x then larger y (below/right). */
function byNearest(base: Point) {
  return (a: Point, b: Point): number => {
    const da = (a.x - base.x) ** 2 + (a.y - base.y) ** 2;
    const db = (b.x - base.x) ** 2 + (b.y - base.y) ** 2;
    if (da !== db) return da - db;
    if (a.x !== b.x) return b.x - a.x;
    return b.y - a.y;
  };
}

/**
 * Snap `anchor`; if that slot is clear, return it. Otherwise return the grid-aligned
 * point closest to it that overlaps nothing in `occupied` — the minimal nudge out of
 * the collision, in whatever direction is actually nearest.
 *
 * The free space is the plane minus one exclusion rectangle (half-extent `slot`) per
 * occupied node. The nearest free point to `base` either keeps a coordinate at `base`
 * (sliding straight off one edge) or pins it to a blocker's edge (`o.x ± slot.x` /
 * `o.y ± slot.y`); cross-blocker corners fall out of the product of those candidate
 * coordinates. So the true nearest open slot lives in `xs × ys`, which we scan directly.
 * The candidate beyond the rightmost blocker is always open, so a result always exists.
 * Ties prefer below/right so growth reads naturally.
 *
 * `slot` defaults to `AUTO_SLOT`; pass `MANUAL_SLOT` for the tighter manual-drag gap.
 */
export function findOpenPosition(anchor: Point, occupied: Point[], slot: Slot = AUTO_SLOT): Point {
  const base = snapToGrid(anchor);
  if (isOpen(base, occupied, slot)) return base;

  // Edges (and slot steps) are grid-multiples and `base` is snapped, so every candidate
  // coordinate stays grid-aligned without re-snapping.
  const xs = new Set<number>([base.x]);
  const ys = new Set<number>([base.y]);
  for (const o of occupied) {
    xs.add(o.x + slot.x);
    xs.add(o.x - slot.x);
    ys.add(o.y + slot.y);
    ys.add(o.y - slot.y);
  }

  const nearer = byNearest(base);
  let best: Point | null = null;
  for (const x of xs) {
    for (const y of ys) {
      const candidate = { x, y };
      if (!isOpen(candidate, occupied, slot)) continue;
      if (best === null || nearer(candidate, best) < 0) best = candidate;
    }
  }

  return best ?? base;
}
