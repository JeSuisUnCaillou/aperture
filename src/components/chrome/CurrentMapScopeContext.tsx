'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ActivityStatScope } from '@/types';

interface CurrentMapScopeValue {
  scope: ActivityStatScope | null;
  setScope: (scope: ActivityStatScope | null) => void;
}

const CurrentMapScopeContext = createContext<CurrentMapScopeValue | null>(null);

/**
 * Publishes the currently-viewed map's ownership class (private/corp/alliance)
 * to header chrome that lives outside the map page (e.g. the Statistics dialog).
 * Mounted in the app layout so it spans both the header and the map view.
 */
export function CurrentMapScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<ActivityStatScope | null>(null);
  return (
    <CurrentMapScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </CurrentMapScopeContext.Provider>
  );
}

/** The current map's scope, or `null` when no map is being viewed. */
export function useCurrentMapScope(): ActivityStatScope | null {
  return useContext(CurrentMapScopeContext)?.scope ?? null;
}

/** Setter for the current map scope; no-op outside the provider. */
export function useSetCurrentMapScope(): (scope: ActivityStatScope | null) => void {
  const ctx = useContext(CurrentMapScopeContext);
  return ctx?.setScope ?? (() => {});
}
