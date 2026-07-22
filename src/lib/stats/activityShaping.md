## activityShaping.ts

**Purpose:** Shared kind-grouping and exclusion logic over `ap_activity_rollup`, imported by both the UI reader (`src/lib/stats/activity.ts`) and the integration reader (`src/lib/integrations/activityStats.ts`) so they can't drift apart.
**File:** `src/lib/stats/activityShaping.ts`

---

### Types
- `ActivityTriplet` — `{ create, update, delete }` counts. Re-exported from `activity.ts` (and from there, `src/types/index.ts`).
- `ActivityGroup` — `'system' | 'connection' | 'signature'`.
- `ActivityBucketPeriod` — `'day' | 'week' | 'month' | 'year'`.

---

### emptyTriplet(): ActivityTriplet
Returns a zeroed `{ create: 0, update: 0, delete: 0 }`.

---

### KIND_MAP
`Record<string, [ActivityGroup, keyof ActivityTriplet]>` — the nine `ap_map_event` kinds a contribution can carry, mapped to `[group, action]`. `system.*` uses added/updated/removed verbs; `connection.*`/`signature.*` already use create/update/delete. `map.*` kinds and the derived `system.moved` never reach here — excluded in SQL by `activityKindExclusion`.

---

### activityKindExclusion(kindRef: SQL): SQL
Returns the `NOT LIKE 'map.%' AND <> 'system.moved'` predicate for a raw `ap_activity_rollup` query, given the query's qualified `kind` column reference (e.g. `sql.raw('r.kind')`). `system.moved` is the MV's derived bucket for drag-only position updates — never an emitted `ap_map_event.kind` — and is not a contribution to the communal map.

---

### bucketStart(date: Date, period: ActivityBucketPeriod): Date
Normalises `date` to the UTC start of its bucket: `year` → Jan 1, `month` → the 1st, `week` → the Monday of its ISO week, `day` → that UTC midnight.

### toISODate(date: Date): string
`yyyy-mm-dd` in UTC.
