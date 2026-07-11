import { describe, expect, it } from 'vitest';
import {
  annotateWormholeTypes,
  partitionWormholeOptions,
  subgroupByClass,
  type WormholeCatalogEntry,
} from '@/lib/map/wormholeCatalog';

// Host system: a C3 whose only static is A242 (typeId 1).
const SYSTEM = { security: 'C3', staticTypeIds: [1] };

function entry(
  typeId: number,
  name: string,
  overrides: Partial<WormholeCatalogEntry> = {},
): WormholeCatalogEntry {
  return {
    typeId,
    name,
    sourceClasses: ['C3'],
    targetClass: null,
    targetSystemId: null,
    targetSystemName: null,
    jumpMassClass: null,
    ...overrides,
  };
}

describe('partitionWormholeOptions', () => {
  it('sorts each option into its semantic bucket', () => {
    const catalog: WormholeCatalogEntry[] = [
      entry(1, 'A242', { targetClass: 'C3' }), // the system's static
      entry(2, 'K162', { sourceClasses: null }), // exit hole
      entry(3, 'N062', { targetClass: 'C5', jumpMassClass: 'l' }), // wandering
      entry(4, 'E004', { targetClass: 'C1', jumpMassClass: 's' }), // frig hole
      entry(5, 'F135', { targetClass: 'C12', jumpMassClass: 'l' }), // Thera edge
      entry(6, 'X702', { sourceClasses: ['C5'], targetClass: 'C5' }), // not class-matched
    ];
    const groups = partitionWormholeOptions(annotateWormholeTypes(catalog, SYSTEM));

    expect(groups.statics.map((o) => o.name)).toEqual(['A242']);
    expect(groups.k162.map((o) => o.name)).toEqual(['K162']);
    expect(groups.wandering.map((o) => o.name)).toEqual(['N062']);
    expect(groups.frig.map((o) => o.name)).toEqual(['E004']);
    expect(groups.edge.map((o) => o.name)).toEqual(['F135']);
    expect(groups.others.map((o) => o.name)).toEqual(['X702']);
  });

  it('routes a Pochven-target hole to the edge group', () => {
    const catalog = [entry(10, 'C729', { targetClass: 'P', jumpMassClass: 'm' })];
    const groups = partitionWormholeOptions(annotateWormholeTypes(catalog, SYSTEM));
    expect(groups.edge.map((o) => o.name)).toEqual(['C729']);
    expect(groups.wandering).toHaveLength(0);
  });

  it('preserves catalog order within a bucket', () => {
    const catalog = [
      entry(11, 'B274', { targetClass: 'H', jumpMassClass: 'l' }),
      entry(12, 'A239', { targetClass: 'H', jumpMassClass: 'l' }),
    ];
    const groups = partitionWormholeOptions(annotateWormholeTypes(catalog, SYSTEM));
    expect(groups.wandering.map((o) => o.name)).toEqual(['B274', 'A239']);
  });
});

describe('subgroupByClass', () => {
  it('clusters by target class, wormhole classes ordered before special ones', () => {
    const catalog = [
      entry(1, 'C729', { targetClass: 'P', jumpMassClass: 'm' }),
      entry(2, 'N062', { targetClass: 'C5', jumpMassClass: 'l' }),
      entry(3, 'X702', { targetClass: 'C3', jumpMassClass: 'l' }),
    ];
    const opts = annotateWormholeTypes(catalog, SYSTEM);
    const subs = subgroupByClass(opts);
    expect(subs.map((s) => s.classLabel)).toEqual(['C3', 'C5', 'P']);
  });

  it('sorts null target class last', () => {
    const catalog = [
      entry(1, 'Z999', { targetClass: null, jumpMassClass: 'l' }),
      entry(2, 'N062', { targetClass: 'C5', jumpMassClass: 'l' }),
    ];
    const subs = subgroupByClass(annotateWormholeTypes(catalog, SYSTEM));
    expect(subs.map((s) => s.classLabel)).toEqual(['C5', null]);
  });
});
