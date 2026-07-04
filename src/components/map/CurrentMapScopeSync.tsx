'use client';

import { useEffect } from 'react';
import type { ActivityStatScope } from '@/types';
import { useSetCurrentMapScope } from '@/components/chrome/CurrentMapScopeContext';

/**
 * Publishes the viewed map's ownership class into `CurrentMapScopeProvider` so
 * header chrome (the Statistics dialog) can default to it, and clears it on
 * unmount so leaving the map resets the default.
 */
export function CurrentMapScopeSync({ scope }: { scope: ActivityStatScope }) {
  const setScope = useSetCurrentMapScope();
  useEffect(() => {
    setScope(scope);
    return () => setScope(null);
  }, [scope, setScope]);
  return null;
}
