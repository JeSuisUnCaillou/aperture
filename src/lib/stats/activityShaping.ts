import { sql, type SQL } from 'drizzle-orm';

/**
 * Shared shaping for readers built on `ap_activity_rollup` — the UI reader
 * (`src/lib/stats/activity.ts`) and the `/api/integrations/activity-stats`
 * reader (`src/lib/integrations/activityStats.ts`) both import from here so
 * the kind grouping and non-contribution exclusions can't drift apart.
 */

export interface ActivityTriplet {
  create: number;
  update: number;
  delete: number;
}

export type ActivityGroup = 'system' | 'connection' | 'signature';

export function emptyTriplet(): ActivityTriplet {
  return { create: 0, update: 0, delete: 0 };
}

// `kind` → [group, action]. System uses added/updated/removed verbs; connection
// and signature already use create/update/delete. `map.*` kinds never reach
// here (excluded in SQL via `activityKindExclusion`).
export const KIND_MAP: Record<string, [ActivityGroup, keyof ActivityTriplet]> = {
  'system.added': ['system', 'create'],
  'system.updated': ['system', 'update'],
  'system.removed': ['system', 'delete'],
  'connection.create': ['connection', 'create'],
  'connection.update': ['connection', 'update'],
  'connection.delete': ['connection', 'delete'],
  'signature.create': ['signature', 'create'],
  'signature.update': ['signature', 'update'],
  'signature.delete': ['signature', 'delete'],
};

/**
 * Excludes non-contributions from a raw `ap_activity_rollup` query: `map.*`
 * lifecycle noise and the derived `system.moved` bucket (drag-only position
 * updates — never an emitted `ap_map_event.kind`, so it's not a contribution
 * to the communal map). `kindRef` is the query's qualified column reference,
 * e.g. `sql.raw('r.kind')`.
 */
export function activityKindExclusion(kindRef: SQL): SQL {
  return sql`${kindRef} NOT LIKE 'map.%' AND ${kindRef} <> 'system.moved'`;
}

export type ActivityBucketPeriod = 'day' | 'week' | 'month' | 'year';

/** Normalise a date to the start of its bucket for the given period (UTC midnight). */
export function bucketStart(date: Date, period: ActivityBucketPeriod): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (period === 'year') return new Date(Date.UTC(y, 0, 1));
  if (period === 'month') return new Date(Date.UTC(y, m, 1));
  if (period === 'day') return new Date(Date.UTC(y, m, date.getUTCDate()));
  // week → Monday of the ISO week.
  const day = date.getUTCDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(y, m, date.getUTCDate() + offset));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
