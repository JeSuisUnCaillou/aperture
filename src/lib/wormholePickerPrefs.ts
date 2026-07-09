'use client';

/**
 * Wormhole-type picker display preferences. Client-only, persisted to
 * localStorage as a single JSON blob. `grouped` switches the WH-type dropdown
 * between semantic category groups (Statics / K162's / Potential wandering /
 * Frig holes / edge cases) and a flat alphabetical list; the grouped view
 * always orders the wandering and frig-hole sections by destination class.
 * Defaults on. Surfaced in the Map Settings → Settings tab, and exposed as a
 * subscribable store so a toggle applies to open pickers immediately.
 */

export const WH_PICKER_PREFS_KEY = 'aperture:wh-picker:prefs';

export type WhPickerPrefs = { grouped: boolean };

export const DEFAULT_WH_PICKER_PREFS: WhPickerPrefs = { grouped: true };

// Cached snapshot so `readWhPickerPrefs` returns a stable reference between
// renders (required by `useSyncExternalStore`); invalidated on write.
let cache: WhPickerPrefs | null = null;
const listeners = new Set<() => void>();

function compute(): WhPickerPrefs {
  try {
    const raw = localStorage.getItem(WH_PICKER_PREFS_KEY);
    if (!raw) return DEFAULT_WH_PICKER_PREFS;
    const parsed = JSON.parse(raw) as Partial<WhPickerPrefs>;
    return {
      grouped:
        typeof parsed.grouped === 'boolean' ? parsed.grouped : DEFAULT_WH_PICKER_PREFS.grouped,
    };
  } catch {
    return DEFAULT_WH_PICKER_PREFS;
  }
}

/** Read the picker prefs from localStorage, falling back to defaults per field. */
export function readWhPickerPrefs(): WhPickerPrefs {
  if (cache == null) cache = compute();
  return cache;
}

/** Server snapshot for `useSyncExternalStore` — always the defaults. */
export function getServerWhPickerPrefs(): WhPickerPrefs {
  return DEFAULT_WH_PICKER_PREFS;
}

/** Persist the picker prefs and notify subscribers so open pickers re-render. */
export function writeWhPickerPrefs(prefs: WhPickerPrefs): void {
  try {
    localStorage.setItem(WH_PICKER_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  cache = prefs;
  for (const listener of listeners) listener();
}

/** Subscribe to pref changes; returns an unsubscribe fn. */
export function subscribeWhPickerPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
