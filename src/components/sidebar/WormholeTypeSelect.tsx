'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchWormholeCatalog } from '@/lib/map/client';
import { systemClassColor } from '@/components/map/styling';
import { systemDisplayName } from '@/lib/eve/drifterSystems';
import {
  annotateWormholeTypes,
  partitionWormholeOptions,
  subgroupByClass,
  type WormholeCatalogEntry,
} from '@/lib/map/wormholeCatalog';
import {
  getServerWhPickerPrefs,
  readWhPickerPrefs,
  subscribeWhPickerPrefs,
} from '@/lib/wormholePickerPrefs';
import type { WormholeTypeOption } from '@/types';

const NONE_VALUE = '__none__';

// The destination shown on the right of a WH option: a fixed-destination hole
// (J377 → Turnur, Thera/Drifter holes) names its pinned system; every other
// hole shows its target class label. Drifter systems resolve to their community
// short name (Barbican, Conflux, …) via `systemDisplayName`; every other system
// keeps its catalog name. Colour is always keyed off the class so Turnur still
// reads as low-sec orange.
function destinationLabel(opt: WormholeTypeOption): string | null {
  if (opt.targetSystemName == null || opt.targetSystemId == null) return opt.targetClass;
  return systemDisplayName(opt.targetSystemId, opt.targetSystemName);
}

function OptionDivider() {
  return <div className="my-0.5 h-px bg-border" />;
}

function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-0.5 text-[11px] font-medium uppercase text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * Class-filtered wormhole-type dropdown for the signature inspector. Loads the
 * static, system-independent WH catalog once per session (shared by every
 * dropdown via `fetchWormholeCatalog`), then derives this system's class
 * grouping locally with `annotateWormholeTypes` — no per-system fetch.
 */
export function WormholeTypeSelect({
  systemSecurity,
  staticTypeIds,
  value,
  onValueChange,
  disabled,
  destinationClass,
  destinationSystemId,
  triggerClassName,
}: {
  /** Host system's class label (`MapSystemNode.security`) — drives `matchesClass`. */
  systemSecurity: string | null;
  /** Host system's static `universe_wormhole.type_id` set (`MapSystemNode.staticTypeIds`). */
  staticTypeIds: number[];
  /** Selected `universe_wormhole.type_id`, or null when unset. */
  value: number | null;
  onValueChange: (next: number | null) => void;
  disabled?: boolean;
  /**
   * The bound leads-to connection's far-end class label. When set, back-filters
   * the list to types whose `targetClass` matches it (plus `K162` / any
   * null-target hole, which resolve from the far side); null = no destination
   * constraint. The current `value` is always kept so a mismatched existing
   * selection still renders in the trigger.
   */
  destinationClass?: string | null;
  /**
   * The bound leads-to connection's far-end `universe_system.id`. A
   * fixed-destination hole (J377 → Turnur) is kept by the back-filter only when
   * this matches its pinned `targetSystemId`, never merely a same-class system.
   */
  destinationSystemId?: number | null;
  triggerClassName?: string;
}) {
  // Combine `loading` and `catalog` in one state object so the effect body only
  // calls `setState` from the async resolver — never synchronously during the
  // effect run (which would trip the cascading-render lint rule).
  const [state, setState] = useState<{ loading: boolean; catalog: WormholeCatalogEntry[] }>({
    loading: true,
    catalog: [],
  });
  // Whether the "other classes" group (holes that don't plausibly spawn here) is
  // expanded. Collapsed by default — the whole point is a short list.
  const [showAll, setShowAll] = useState(false);
  // Display prefs (grouped vs alphabetical). Subscribed to the prefs store so a
  // toggle flipped in Map Settings re-renders every open picker live.
  const prefs = useSyncExternalStore(
    subscribeWhPickerPrefs,
    readWhPickerPrefs,
    getServerWhPickerPrefs,
  );

  useEffect(() => {
    let cancelled = false;
    fetchWormholeCatalog().then((result) => {
      if (cancelled) return;
      setState({ loading: false, catalog: result.ok ? result.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { loading } = state;
  const options = useMemo(
    () => annotateWormholeTypes(state.catalog, { security: systemSecurity, staticTypeIds }),
    [state.catalog, systemSecurity, staticTypeIds],
  );

  const items = useMemo(() => {
    const labels: Record<string, string> = { [NONE_VALUE]: 'Select type…' };
    for (const opt of options) labels[String(opt.typeId)] = opt.name;
    return labels;
  }, [options]);

  // A type is consistent with the bound leads-to when it is the current
  // selection (kept so a mismatched existing pick still renders in its section),
  // resolves from the far side (null target, e.g. K162), or opens onto the far
  // end. A fixed-destination hole (`targetSystemId` set) matches only its exact
  // pinned system — J377 → Turnur, not any low-sec; every other hole matches on
  // the destination class.
  const destinationConsistent = useCallback(
    (opt: WormholeTypeOption) => {
      if (opt.typeId === value) return true;
      if (opt.targetSystemId != null) return opt.targetSystemId === destinationSystemId;
      if (opt.targetClass == null) return true;
      return opt.targetClass === destinationClass;
    },
    [destinationClass, destinationSystemId, value],
  );

  // Default-visible semantic groups (statics pinned, K162, class-matched
  // wandering/frig/edge), each keeping the catalog's alphabetical order and —
  // when a leads-to is bound — narrowed to that destination class. `others` is
  // the full complement: every remaining catalog hole, surfaced only behind the
  // "show all" fallback, unconstrained by the destination so nothing is ever
  // unreachable.
  const { defaults, others } = useMemo(() => {
    const g = partitionWormholeOptions(options);
    const keep = (opts: WormholeTypeOption[]) =>
      destinationClass == null ? opts : opts.filter(destinationConsistent);
    const defaults = {
      statics: keep(g.statics),
      k162: keep(g.k162),
      wandering: keep(g.wandering),
      frig: keep(g.frig),
      edge: keep(g.edge),
    };
    const shown = new Set(
      [
        ...defaults.statics,
        ...defaults.k162,
        ...defaults.wandering,
        ...defaults.frig,
        ...defaults.edge,
      ].map((o) => o.typeId),
    );
    return { defaults, others: options.filter((o) => !shown.has(o.typeId)) };
  }, [options, destinationClass, destinationConsistent]);

  const stringValue = value == null ? NONE_VALUE : String(value);

  // Color-code the destination class with the same palette the map uses for
  // system-node statics, so a hole's target reads consistently in both places.
  const renderOption = (opt: WormholeTypeOption) => (
    <SelectItem className="py-1" key={opt.typeId} value={String(opt.typeId)}>
      <span className="flex w-full justify-between gap-4">
        <span>{opt.name}</span>
        {destinationLabel(opt) && (
          <span
            className="shrink-0 font-bold"
            style={{ color: systemClassColor(opt.targetClass) }}
          >
            {destinationLabel(opt)}
          </span>
        )}
      </span>
    </SelectItem>
  );

  // A titled section. When `subgroup`, the options are clustered by destination
  // class (each row already shows its color-coded class, so no per-class header
  // is needed); otherwise catalog order.
  const renderGroup = (label: string, opts: WormholeTypeOption[], subgroup: boolean): ReactNode => {
    const ordered = subgroup ? subgroupByClass(opts).flatMap((sub) => sub.options) : opts;
    return (
      <>
        <GroupHeader>{label}</GroupHeader>
        {ordered.map(renderOption)}
      </>
    );
  };

  const sections = (
    [
      ['statics', 'Statics', defaults.statics, false],
      ['k162', "K162's", defaults.k162, false],
      ['wandering', 'Potential wandering', defaults.wandering, true],
      ['frig', 'Frig holes', defaults.frig, true],
      ['edge', 'Edge cases', defaults.edge, false],
    ] as const
  )
    .filter(([, , opts]) => opts.length > 0)
    .map(([id, label, opts, subgroup]) => ({ id, node: renderGroup(label, opts, subgroup) }));

  return (
    <Select<string>
      value={stringValue}
      onValueChange={(next) => {
        if (!next || next === NONE_VALUE) onValueChange(null);
        else onValueChange(Number(next));
      }}
      items={items}
      disabled={disabled || loading}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue className="min-w-0 flex-1">
          {(val: string) => {
            const opt = val === NONE_VALUE ? undefined : options.find((o) => String(o.typeId) === val);
            if (!opt) return loading ? 'Loading…' : 'Select type…';
            return (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
                <span className="truncate">{opt.name}</span>
                {destinationLabel(opt) && (
                  <span
                    className="shrink-0 font-bold"
                    style={{ color: systemClassColor(opt.targetClass) }}
                  >
                    {destinationLabel(opt)}
                  </span>
                )}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="p-0.5">
        <SelectItem className="py-1 text-muted-foreground" value={NONE_VALUE}>
          {loading ? 'Loading…' : 'Select type…'}
        </SelectItem>
        {prefs.grouped ? (
          <>
            {sections.map((section, i) => (
              <Fragment key={section.id}>
                {i > 0 && <OptionDivider />}
                {section.node}
              </Fragment>
            ))}

            {others.length > 0 && (
              <>
                <OptionDivider />
                <button
                  type="button"
                  // Toggle the "other classes" group without selecting an item or
                  // dismissing the popup (this isn't a SelectItem, so base-ui leaves
                  // it alone — just stop the click from bubbling to the trigger).
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAll((v) => !v);
                  }}
                  className="w-full rounded-md px-2 py-1 text-left text-[11px] font-medium uppercase text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {showAll ? 'Show fewer' : `Show all types (+${others.length})`}
                </button>
                {showAll && others.map(renderOption)}
              </>
            )}
          </>
        ) : (
          options.map(renderOption)
        )}
      </SelectContent>
    </Select>
  );
}
