import { describe, expect, it } from 'vitest';
import {
  AUTO_SLOT,
  GRID_SIZE,
  MANUAL_SLOT,
  NODE_HEIGHT,
  NODE_WIDTH,
  SLOT_X,
  SLOT_Y,
  findOpenPosition,
  overlaps,
  snapToGrid,
  type Point,
} from '@/lib/map/placement';

describe('snapToGrid', () => {
  it('rounds both axes to the nearest GRID_SIZE', () => {
    expect(snapToGrid({ x: 12, y: 13 })).toEqual({ x: 10, y: 10 });
    expect(snapToGrid({ x: 38, y: -38 })).toEqual({ x: 40, y: -40 });
  });

  it('leaves already-aligned points untouched', () => {
    expect(snapToGrid({ x: GRID_SIZE * 4, y: GRID_SIZE * -2 })).toEqual({
      x: GRID_SIZE * 4,
      y: GRID_SIZE * -2,
    });
  });
});

describe('overlaps', () => {
  it('is true when both axes are within a slot step', () => {
    expect(overlaps({ x: 0, y: 0 }, { x: SLOT_X - 1, y: SLOT_Y - 1 })).toBe(true);
  });

  it('is false once either axis clears a full slot step', () => {
    expect(overlaps({ x: 0, y: 0 }, { x: SLOT_X, y: 0 })).toBe(false);
    expect(overlaps({ x: 0, y: 0 }, { x: 0, y: SLOT_Y })).toBe(false);
  });
});

describe('manual-move slot decoupling', () => {
  it('MANUAL_SLOT is tighter than AUTO_SLOT on both axes', () => {
    expect(MANUAL_SLOT.x).toBeLessThan(AUTO_SLOT.x); // horizontal packs closer
    expect(MANUAL_SLOT.y).toBeLessThan(AUTO_SLOT.y); // vertical packs closer
    // SLOT_X/SLOT_Y remain the auto components.
    expect({ x: SLOT_X, y: SLOT_Y }).toEqual(AUTO_SLOT);
  });

  it('every slot is grid-aligned and clears the node footprint (so drops never overlap)', () => {
    for (const slot of [AUTO_SLOT, MANUAL_SLOT]) {
      expect(slot.x % GRID_SIZE).toBe(0);
      expect(slot.y % GRID_SIZE).toBe(0);
      expect(slot.x).toBeGreaterThanOrEqual(NODE_WIDTH);
      expect(slot.y).toBeGreaterThanOrEqual(NODE_HEIGHT);
    }
  });

  it('overlaps at MANUAL_SLOT lets nodes pack closer than the auto gap', () => {
    const a = { x: 0, y: 0 };
    // Spacings the auto gap forbids but the tighter manual gap allows, per axis.
    const closerX = { x: MANUAL_SLOT.x, y: 0 };
    const closerY = { x: 0, y: MANUAL_SLOT.y };
    expect(overlaps(a, closerX)).toBe(true); // auto (default) still collides
    expect(overlaps(a, closerX, MANUAL_SLOT)).toBe(false); // manual clears
    expect(overlaps(a, closerY)).toBe(true);
    expect(overlaps(a, closerY, MANUAL_SLOT)).toBe(false);
  });

  it('findOpenPosition with MANUAL_SLOT nudges to the tighter edge', () => {
    const blocker = { x: 0, y: 0 };
    const drop = { x: MANUAL_SLOT.x - GRID_SIZE, y: 0 };
    const pos = findOpenPosition(drop, [blocker], MANUAL_SLOT);
    expect(pos).toEqual({ x: MANUAL_SLOT.x, y: 0 });
    expect(overlaps(pos, blocker, MANUAL_SLOT)).toBe(false);
  });
});

describe('findOpenPosition', () => {
  it('returns the snapped anchor on an empty map', () => {
    expect(findOpenPosition({ x: 12, y: 13 }, [])).toEqual({ x: 10, y: 10 });
  });

  it('spills outward when the anchor cell is taken', () => {
    const anchor = { x: 0, y: 0 };
    const pos = findOpenPosition(anchor, [{ x: 0, y: 0 }]);
    expect(overlaps(pos, { x: 0, y: 0 })).toBe(false);
    expect(snapToGrid(pos)).toEqual(pos);
  });

  it('spills to a second ring when the first ring is fully occupied', () => {
    const anchor = { x: 0, y: 0 };
    // Anchor + all 8 first-ring slots occupied.
    const occupied: Point[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        occupied.push({ x: dx * SLOT_X, y: dy * SLOT_Y });
      }
    }
    const pos = findOpenPosition(anchor, occupied);
    expect(occupied.some((o) => overlaps(pos, o))).toBe(false);
    // Must have reached at least the second ring on one axis.
    const ringX = Math.abs(pos.x) / SLOT_X;
    const ringY = Math.abs(pos.y) / SLOT_Y;
    expect(Math.max(ringX, ringY)).toBeGreaterThanOrEqual(2);
  });

  it('sneaking up from below settles just below, not above the blocker', () => {
    const blocker = { x: 0, y: 0 };
    // Dragged up into the bottom of the blocker's zone (edge is at SLOT_Y).
    const drop = { x: 0, y: SLOT_Y - GRID_SIZE };
    const pos = findOpenPosition(drop, [blocker]);
    expect(pos).toEqual({ x: 0, y: SLOT_Y });
    expect(pos.y).toBeGreaterThan(blocker.y);
  });

  it('nudged into the right node settles beside the cluster, not above it', () => {
    // Dragged node boxed by neighbours above and below, a node one slot to its right.
    const above = { x: 0, y: -SLOT_Y };
    const below = { x: 0, y: SLOT_Y };
    const right = { x: SLOT_X, y: 0 };
    const occupied = [above, below, right];
    // Nudged a bit right from home — just into the right node's zone.
    const drop = { x: GRID_SIZE, y: 0 };
    const pos = findOpenPosition(drop, occupied);
    expect(occupied.some((o) => overlaps(pos, o))).toBe(false);
    // The nearest free slot is back to the left at the home row — never jumped above.
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('nudges only to the exclusion-zone edge when dragged just inside it', () => {
    // Dropped one grid step inside a node's x-exclusion zone (edge is at SLOT_X).
    const blocker = { x: 0, y: 0 };
    const drop = { x: SLOT_X - GRID_SIZE, y: 0 };
    const pos = findOpenPosition(drop, [blocker]);
    // Slides out to the threshold on x — a single grid step — not a full slot on y.
    expect(pos).toEqual({ x: SLOT_X, y: 0 });
    expect(overlaps(pos, blocker)).toBe(false);
  });

  it('slides on the cheaper axis (y) when dropped deep on x but shallow on y', () => {
    const blocker = { x: 0, y: 0 };
    // Far into the x zone but only one grid step into the y zone.
    const drop = { x: GRID_SIZE, y: SLOT_Y - GRID_SIZE };
    const pos = findOpenPosition(drop, [blocker]);
    expect(pos).toEqual({ x: GRID_SIZE, y: SLOT_Y });
    expect(overlaps(pos, blocker)).toBe(false);
  });

  it('never returns a slot overlapping any occupied point', () => {
    const occupied: Point[] = [
      { x: 0, y: 0 },
      { x: SLOT_X, y: 0 },
      { x: -SLOT_X, y: SLOT_Y },
      { x: 2 * SLOT_X, y: -SLOT_Y },
    ];
    const pos = findOpenPosition({ x: 30, y: 30 }, occupied);
    expect(occupied.some((o) => overlaps(pos, o))).toBe(false);
    expect(snapToGrid(pos)).toEqual(pos);
  });
});
