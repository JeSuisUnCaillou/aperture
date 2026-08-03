'use client';

import { useEffect, useRef, useState } from 'react';
import { apertureConfig } from '../../aperture.config';

/**
 * Detects that the server is serving a build newer than the one this page was
 * loaded from, and retires the stale tab when it can do so unnoticed.
 */
export function useAppUpdate(observedBuild: string | null | undefined): boolean {
  const baseline = useRef<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!observedBuild) return;
    if (baseline.current === null) {
      baseline.current = observedBuild;
      return;
    }
    if (observedBuild !== baseline.current) setPending(true);
  }, [observedBuild]);

  useEffect(() => {
    if (!pending) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function onVisibilityChange(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (document.visibilityState !== 'hidden') return;
      timer = setTimeout(() => window.location.reload(), apertureConfig.APP_UPDATE_IDLE_RELOAD_MS);
    }

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pending]);

  return pending;
}
