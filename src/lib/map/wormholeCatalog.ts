import type { WhJumpMass } from '@/lib/map/enumLabels';

/**
 * Client-safe wormhole-catalog shapes + annotation. No `import 'server-only'`:
 * the catalog is static reference data fetched once per session, and the
 * dropdown computes its per-system grouping (`isStatic` / `matchesClass`)
 * locally rather than re-fetching the whole catalog per system. The DB read
 * that produces a `WormholeCatalogEntry[]` lives server-side in
 * `wormholeTypes.ts`.
 */

/**
 * One row of the immutable wormhole catalog — identical for every system. Class
 * filtering is derived from these fields on the client, not baked into the row.
 */
export type WormholeCatalogEntry = {
  typeId: number;
  /** WH code, e.g. `A239`, `K162`. */
  name: string;
  /** Classes it can spawn in; null = source unspecified (K162 + Drifter/shattered-access holes). */
  sourceClasses: string[] | null;
  /** Class it leads into; null = resolved from the far side. */
  targetClass: string | null;
  /** Inferred per-jump size band from `wormholeMaxJumpMass`; null = unknown (e.g. K162). */
  jumpMassClass: WhJumpMass | null;
};

/**
 * Bucket a wormhole's `wormholeMaxJumpMass` (kg) into the four community size
 * bands the connection editor uses. The thresholds sit in the wide gaps between
 * EVE's discrete jump-mass values (5M / 62M / 300M·375M / 1B+), so they're
 * robust to which exact value a given WH carries:
 *   - `s`  frigate holes (5,000,000)
 *   - `m`  no battleships (≤ 62,000,000)
 *   - `l`  battleships (300,000,000 / 375,000,000) — e.g. O477
 *   - `xl` capitals (≥ 1,000,000,000)
 * Returns `null` when the type has no jump-mass dogma value (can't infer).
 */
export function jumpMassBand(kg: number | null): WhJumpMass | null {
  if (kg == null) return null;
  if (kg <= 5_000_000) return 's';
  if (kg <= 100_000_000) return 'm';
  if (kg < 1_000_000_000) return 'l';
  return 'xl';
}

/**
 * A catalog entry annotated for one host system's WH-type dropdown: tagged with
 * whether it is one of the system's statics and whether it plausibly spawns here.
 */
export type WormholeTypeOption = WormholeCatalogEntry & {
  /** True when this type is one of the host system's statics (anoik.is). */
  isStatic: boolean;
  /**
   * True when this hole plausibly spawns in the host system: its source set is
   * null (appears anywhere), contains the system's class, or it is one of the
   * system's statics. Drives the dropdown's default vs. "show all" split.
   */
  matchesClass: boolean;
};

/**
 * Annotate the static catalog for one host system — the client-side equivalent
 * of what the server used to compute per request. `system.security` is the class
 * label (C1–C6 / H / L / 0.0 / …, the same labels `sourceClasses` uses);
 * `staticTypeIds` is the system's static `universe_wormhole.type_id` set. The
 * static clause keeps a shattered system's odd-class statics visible by default.
 */
export function annotateWormholeTypes(
  catalog: WormholeCatalogEntry[],
  system: { security: string | null; staticTypeIds: number[] },
): WormholeTypeOption[] {
  const staticTypeIds = new Set(system.staticTypeIds);
  return catalog.map((entry) => {
    const isStatic = staticTypeIds.has(entry.typeId);
    const matchesClass =
      entry.sourceClasses == null ||
      (system.security != null && entry.sourceClasses.includes(system.security)) ||
      isStatic;
    return { ...entry, isStatic, matchesClass };
  });
}

/** Destination classes that get their own "edge case" group (Thera, Pochven). */
export const EDGE_TARGET_CLASSES = new Set(['C12', 'P']);

// Class ordering for sub-group headers: wormhole classes first, then k-space /
// special destinations. Anything unlisted (incl. null) sorts to the end.
const CLASS_ORDER = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C13', 'H', 'L', '0.0', 'C12', 'P', 'A'];

/**
 * The WH-type picker's semantic groups for one host system. Each bucket keeps
 * the catalog's alphabetical order. `others` (holes that don't plausibly spawn
 * here) stays behind the picker's "show all" toggle; the rest render by default.
 */
export type WormholeGroups = {
  /** The host system's statics. */
  statics: WormholeTypeOption[];
  /** The canonical inbound exit hole (0–1 entries). */
  k162: WormholeTypeOption[];
  /** Class-matched, non-static, non-frig, non-edge holes. */
  wandering: WormholeTypeOption[];
  /** Class-matched frigate-sized holes (`jumpMassClass === 's'`). */
  frig: WormholeTypeOption[];
  /** Class-matched holes leading to a special destination (Thera / Pochven). */
  edge: WormholeTypeOption[];
  /** Holes that don't plausibly spawn in this class (`!matchesClass`). */
  others: WormholeTypeOption[];
};

/** A cluster of options sharing a destination class, for sub-header rendering. */
export type WormholeClassSubgroup = { classLabel: string | null; options: WormholeTypeOption[] };

/**
 * Partition annotated options into the picker's semantic groups in a single
 * pass, preserving the catalog's alphabetical order within each bucket.
 */
export function partitionWormholeOptions(options: WormholeTypeOption[]): WormholeGroups {
  const groups: WormholeGroups = {
    statics: [],
    k162: [],
    wandering: [],
    frig: [],
    edge: [],
    others: [],
  };
  for (const opt of options) {
    if (opt.isStatic) groups.statics.push(opt);
    else if (opt.name === 'K162') groups.k162.push(opt);
    else if (!opt.matchesClass) groups.others.push(opt);
    else if (opt.targetClass != null && EDGE_TARGET_CLASSES.has(opt.targetClass))
      groups.edge.push(opt);
    else if (opt.jumpMassClass === 's') groups.frig.push(opt);
    else groups.wandering.push(opt);
  }
  return groups;
}

/**
 * Cluster options by destination class for the wandering / frig sub-headers.
 * Clusters are ordered by `CLASS_ORDER` (unlisted classes and `null` last);
 * the catalog's alphabetical order is preserved within each cluster.
 */
export function subgroupByClass(options: WormholeTypeOption[]): WormholeClassSubgroup[] {
  const byClass = new Map<string | null, WormholeTypeOption[]>();
  for (const opt of options) {
    const key = opt.targetClass ?? null;
    const bucket = byClass.get(key);
    if (bucket) bucket.push(opt);
    else byClass.set(key, [opt]);
  }
  const rank = (cls: string | null) => {
    if (cls == null) return CLASS_ORDER.length;
    const i = CLASS_ORDER.indexOf(cls);
    return i === -1 ? CLASS_ORDER.length : i;
  };
  return [...byClass.entries()]
    .map(([classLabel, opts]) => ({ classLabel, options: opts }))
    .sort((a, b) => rank(a.classLabel) - rank(b.classLabel));
}
