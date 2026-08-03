'use client';

import { useState } from 'react';
import { useAppUpdate } from '@/lib/appUpdate';
import { healthCheckLoadSchema } from '@/lib/realtime/protocol';
import { useRealtimeEvents } from '@/lib/realtime/useRealtime';

/**
 * Update banner: a deploy replaces the container, so a tab that has been open
 * across one is running code whose chunks no longer exist on the server. The
 * heartbeat's build id is what reveals it. Renders nothing until then.
 */
export function AppUpdateBanner() {
  const [build, setBuild] = useState<string | null>(null);

  useRealtimeEvents((envelope) => {
    if (envelope.task !== 'healthCheck') return;
    const parsed = healthCheckLoadSchema.safeParse(envelope.load);
    if (parsed.success && parsed.data.build) setBuild(parsed.data.build);
  });

  const updateAvailable = useAppUpdate(build);
  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 border-b border-sky-500/40 bg-sky-500/10 px-4 py-2 text-center text-sm text-sky-700 dark:text-sky-300"
    >
      <span>A new version of Aperture is available.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded border border-sky-500/50 px-2 py-0.5 font-medium hover:bg-sky-500/15"
      >
        Reload
      </button>
    </div>
  );
}
