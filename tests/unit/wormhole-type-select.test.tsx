import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/lib/map/client', () => ({ fetchWormholeCatalog: vi.fn() }));
vi.mock('@/components/map/styling', () => ({ systemClassColor: () => '#ffffff' }));
vi.mock('@/lib/wormholePickerPrefs', () => ({
  readWhPickerPrefs: vi.fn(() => ({ grouped: true })),
  getServerWhPickerPrefs: vi.fn(() => ({ grouped: true })),
  subscribeWhPickerPrefs: vi.fn(() => () => {}),
}));

// Stub Base UI Select primitives — they require a portal/popup context jsdom can't provide.
// Each SelectItem renders a div with data-slot="select-item" and data-value=<the value>.
vi.mock('@/components/ui/select', async () => {
  const { createElement } = await import('react');
  const Select = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-slot': 'select' }, children);
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-slot': 'select-trigger' }, children);
  const SelectValue = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-slot': 'select-value' }, typeof children === 'function' ? null : children);
  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-slot': 'select-content' }, children);
  const SelectItem = ({ children, value }: { children?: React.ReactNode; value?: string; className?: string }) =>
    createElement('div', { 'data-slot': 'select-item', 'data-value': value }, children);
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

import { fetchWormholeCatalog } from '@/lib/map/client';
import { readWhPickerPrefs } from '@/lib/wormholePickerPrefs';
import { WormholeTypeSelect } from '@/components/sidebar/WormholeTypeSelect';
import type { WormholeCatalogEntry } from '@/types';

const mockFetch = vi.mocked(fetchWormholeCatalog);
const mockPrefs = vi.mocked(readWhPickerPrefs);

// The host system is a C3 whose only static is A242 (typeId 1). The component
// derives `isStatic` / `matchesClass` from these props via `annotateWormholeTypes`,
// so the fixtures are bare catalog rows and the grouping is computed end-to-end.
const SYSTEM_SECURITY = 'C3';
const SYSTEM_STATIC_TYPE_IDS = [1];

function makeEntry(
  typeId: number,
  name: string,
  overrides: Partial<WormholeCatalogEntry> = {},
): WormholeCatalogEntry {
  return {
    typeId,
    name,
    sourceClasses: ['C5'], // does not include 'C3' → not class-matched unless overridden
    targetClass: null,
    targetSystemId: null,
    targetSystemName: null,
    jumpMassClass: null,
    ...overrides,
  };
}

// A242 is the system's static (typeId 1) → isStatic, hence pinned + matchesClass.
const STATIC_A242 = makeEntry(1, 'A242', { sourceClasses: ['C3'], targetClass: 'C3' });
// K162 has a null source → matches anywhere; the component pins it after statics.
const K162 = makeEntry(2, 'K162', { sourceClasses: null });
const CLASS_MATCHED_C140 = makeEntry(3, 'C140', { sourceClasses: ['C3'] });
const CLASS_MATCHED_N110 = makeEntry(4, 'N110', { sourceClasses: ['C3'] });
const OTHER_X702 = makeEntry(5, 'X702', { sourceClasses: ['C5'] });

function renderSelect(container: HTMLDivElement, root: Root) {
  act(() => {
    root.render(
      <WormholeTypeSelect
        systemSecurity={SYSTEM_SECURITY}
        staticTypeIds={SYSTEM_STATIC_TYPE_IDS}
        value={null}
        onValueChange={vi.fn()}
      />,
    );
  });
}

describe('WormholeTypeSelect — K162 grouping', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockPrefs.mockReturnValue({ grouped: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function resolvedOptions(options: WormholeCatalogEntry[]) {
    mockFetch.mockResolvedValue({ ok: true, data: options });
  }

  function itemValues(): string[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
    )
      .map((el) => el.dataset.value ?? '')
      .filter(Boolean);
  }

  it('renders K162 before other class-matched options', async () => {
    resolvedOptions([STATIC_A242, CLASS_MATCHED_C140, K162, CLASS_MATCHED_N110]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    const k162Idx = values.indexOf('2');
    const c140Idx = values.indexOf('3');
    const n110Idx = values.indexOf('4');

    expect(k162Idx).toBeGreaterThanOrEqual(0);
    expect(k162Idx).toBeLessThan(c140Idx);
    expect(k162Idx).toBeLessThan(n110Idx);
  });

  it('renders K162 after the statics', async () => {
    resolvedOptions([STATIC_A242, K162, CLASS_MATCHED_C140]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    const staticIdx = values.indexOf('1'); // A242
    const k162Idx = values.indexOf('2');

    expect(k162Idx).toBeGreaterThan(staticIdx);
  });

  it('does not include K162 in the class-matched group', async () => {
    resolvedOptions([CLASS_MATCHED_C140, K162, CLASS_MATCHED_N110]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    const k162Idx = values.indexOf('2');
    const c140Idx = values.indexOf('3');
    const n110Idx = values.indexOf('4');

    // K162 comes before both class-matched entries
    expect(k162Idx).toBeLessThan(c140Idx);
    expect(k162Idx).toBeLessThan(n110Idx);
  });

  it('renders without K162 when it is absent from the catalog', async () => {
    resolvedOptions([STATIC_A242, CLASS_MATCHED_C140]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    expect(values).not.toContain('2');
    expect(values).toContain('1'); // A242 static
    expect(values).toContain('3'); // C140 class-matched
  });

  it('renders K162 even when there are no statics', async () => {
    resolvedOptions([CLASS_MATCHED_C140, K162]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    expect(values).toContain('2');
    expect(values.indexOf('2')).toBeLessThan(values.indexOf('3'));
  });

  it('excludes K162 from the others (show-all) group', async () => {
    // K162 has matchesClass:true so it wouldn't normally be in others, but
    // confirm it ends up in exitHole and not pushed to others when it could
    // theoretically slip through — i.e. it's never behind the "show all" toggle.
    resolvedOptions([K162, OTHER_X702]);
    renderSelect(container, root);
    await act(async () => {});

    const content = container.querySelector('[data-slot="select-content"]')!;
    const k162El = content.querySelector('[data-value="2"]');
    expect(k162El).not.toBeNull();

    // X702 is in "others" and hidden by default — its SelectItem should not be in the DOM.
    expect(content.querySelector('[data-value="5"]')).toBeNull();
  });
});

describe('WormholeTypeSelect — grouping modes', () => {
  let container: HTMLDivElement;
  let root: Root;

  // Class-matched holes: a frigate hole (mass 's') and a Thera-target edge hole.
  const FRIG_E004 = makeEntry(6, 'E004', { sourceClasses: ['C3'], targetClass: 'C1', jumpMassClass: 's' });
  const EDGE_F135 = makeEntry(7, 'F135', { sourceClasses: ['C3'], targetClass: 'C12', jumpMassClass: 'l' });

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockPrefs.mockReturnValue({ grouped: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function resolvedOptions(options: WormholeCatalogEntry[]) {
    mockFetch.mockResolvedValue({ ok: true, data: options });
  }

  function itemValues(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="select-item"]'))
      .map((el) => el.dataset.value ?? '')
      .filter(Boolean);
  }

  function headerTexts(): string[] {
    const content = container.querySelector('[data-slot="select-content"]')!;
    return Array.from(content.querySelectorAll<HTMLElement>('div'))
      .map((el) => el.textContent ?? '')
      .filter((t) => /Statics|K162|wandering|Frig|Edge/i.test(t));
  }

  it('renders the frig hole and edge hole under their own group headers', async () => {
    resolvedOptions([STATIC_A242, K162, CLASS_MATCHED_C140, FRIG_E004, EDGE_F135]);
    renderSelect(container, root);
    await act(async () => {});

    // All class-matched items are visible by default (no "show all" needed).
    const values = itemValues();
    expect(values).toContain('6'); // frig
    expect(values).toContain('7'); // edge

    const headers = headerTexts();
    expect(headers.some((h) => /Frig holes/i.test(h))).toBe(true);
    expect(headers.some((h) => /Edge cases/i.test(h))).toBe(true);
  });

  it('alphabetical mode renders a flat list with no group headers and no show-all gating', async () => {
    mockPrefs.mockReturnValue({ grouped: false });
    resolvedOptions([STATIC_A242, CLASS_MATCHED_C140, OTHER_X702]);
    renderSelect(container, root);
    await act(async () => {});

    const values = itemValues();
    // Every catalog option is present, including the otherwise-hidden "others" hole.
    expect(values).toContain('1');
    expect(values).toContain('3');
    expect(values).toContain('5'); // X702 — behind "show all" only in grouped mode

    // No section headers in alphabetical mode.
    expect(headerTexts()).toHaveLength(0);
  });
});

describe('WormholeTypeSelect — destination back-filter', () => {
  let container: HTMLDivElement;
  let root: Root;

  // Class-matched holes with concrete destinations: two leading to C2, one to C4.
  const TO_C2_D845 = makeEntry(10, 'D845', { sourceClasses: ['C3'], targetClass: 'C2' });
  const TO_C2_O883 = makeEntry(11, 'O883', { sourceClasses: ['C3'], targetClass: 'C2' });
  const TO_C4_M267 = makeEntry(12, 'M267', { sourceClasses: ['C3'], targetClass: 'C4' });

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockPrefs.mockReturnValue({ grouped: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function resolvedOptions(options: WormholeCatalogEntry[]) {
    mockFetch.mockResolvedValue({ ok: true, data: options });
  }

  function itemValues(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-slot="select-item"]'))
      .map((el) => el.dataset.value ?? '')
      .filter(Boolean);
  }

  function renderWith(value: number | null, destinationClass: string | null) {
    act(() => {
      root.render(
        <WormholeTypeSelect
          systemSecurity={SYSTEM_SECURITY}
          staticTypeIds={SYSTEM_STATIC_TYPE_IDS}
          value={value}
          onValueChange={vi.fn()}
          destinationClass={destinationClass}
        />,
      );
    });
  }

  it('keeps only types whose targetClass matches the destination (plus null-target K162)', async () => {
    resolvedOptions([TO_C2_D845, TO_C2_O883, TO_C4_M267, K162]);
    renderWith(null, 'C2');
    await act(async () => {});

    const values = itemValues();
    expect(values).toContain('10'); // D845 → C2
    expect(values).toContain('11'); // O883 → C2
    expect(values).toContain('2'); // K162 → null target, always consistent
    expect(values).not.toContain('12'); // M267 → C4, filtered out
  });

  it('drops the system static when it is inconsistent with the destination', async () => {
    // A242 static leads to C3; a C2 destination excludes it.
    resolvedOptions([STATIC_A242, TO_C2_D845, K162]);
    renderWith(null, 'C2');
    await act(async () => {});

    const values = itemValues();
    expect(values).not.toContain('1'); // A242 static → C3
    expect(values).toContain('10'); // D845 → C2
  });

  it('keeps the current selection visible even when it mismatches the destination', async () => {
    resolvedOptions([TO_C2_D845, TO_C4_M267]);
    renderWith(12, 'C2'); // M267 (→C4) is selected but destination is C2
    await act(async () => {});

    const values = itemValues();
    expect(values).toContain('12'); // exempted so the trigger can still render it
    expect(values).toContain('10'); // D845 → C2
  });

  it('applies no destination constraint when destinationClass is null', async () => {
    resolvedOptions([TO_C2_D845, TO_C4_M267, K162]);
    renderWith(null, null);
    await act(async () => {});

    const values = itemValues();
    expect(values).toContain('10');
    expect(values).toContain('12'); // not filtered — no destination set
    expect(values).toContain('2');
  });

  it('surfaces destination-inconsistent holes only behind the show-all fallback', async () => {
    resolvedOptions([TO_C2_D845, TO_C4_M267, K162]);
    renderWith(null, 'C2');
    await act(async () => {});

    // M267 (→C4) is hidden from the default sections under a C2 destination.
    expect(itemValues()).not.toContain('12');

    // The "show all" fallback counts it and, when expanded, reveals it — the
    // fallback is unconstrained by the destination so nothing is unreachable.
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      /show all types/i.test(b.textContent ?? ''),
    );
    expect(button).toBeTruthy();
    expect(button!.textContent).toMatch(/\+1/);

    act(() => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(itemValues()).toContain('12');
  });
});

describe('WormholeTypeSelect — fixed-destination labels', () => {
  let container: HTMLDivElement;
  let root: Root;

  // Fixed-destination holes: J377 pins Turnur (a normal k-space system), B735
  // pins the Drifter Barbican complex (id 31000002 in DRIFTER_SYSTEMS). Both
  // spawn k-space-side (null source → matchesClass), so they render by default.
  const J377_TURNUR = makeEntry(20, 'J377', {
    sourceClasses: null,
    targetClass: 'L',
    targetSystemId: 30002086,
    targetSystemName: 'Turnur',
  });
  const B735_BARBICAN = makeEntry(21, 'B735', {
    sourceClasses: null,
    targetClass: 'C15',
    targetSystemId: 31000002,
    targetSystemName: 'Liberated Barbican',
  });
  const NORMAL_N110 = makeEntry(22, 'N110', { sourceClasses: ['C3'], targetClass: 'H' });

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mockPrefs.mockReturnValue({ grouped: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function resolvedOptions(options: WormholeCatalogEntry[]) {
    mockFetch.mockResolvedValue({ ok: true, data: options });
  }

  function itemText(typeId: number): string {
    const el = container.querySelector<HTMLElement>(`[data-value="${typeId}"]`);
    return el?.textContent ?? '';
  }

  it('shows the pinned system name for a fixed-destination hole, not its class', async () => {
    resolvedOptions([J377_TURNUR]);
    renderSelect(container, root);
    await act(async () => {});

    const text = itemText(20);
    expect(text).toContain('Turnur');
    // The bare class letter is not surfaced in place of the name.
    expect(text).not.toMatch(/\bL\b/);
  });

  it('shows the Drifter short name for a Drifter hole, not the full lore name', async () => {
    resolvedOptions([B735_BARBICAN]);
    renderSelect(container, root);
    await act(async () => {});

    const text = itemText(21);
    expect(text).toContain('Barbican');
    expect(text).not.toContain('Liberated');
  });

  it('shows the target class for a normal hole', async () => {
    resolvedOptions([NORMAL_N110]);
    renderSelect(container, root);
    await act(async () => {});

    expect(itemText(22)).toContain('H');
  });
});
