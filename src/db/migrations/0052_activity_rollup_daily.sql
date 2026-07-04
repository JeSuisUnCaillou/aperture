-- Daily-grain activity rollup (GitHub issue: calendar-month stats accuracy).
--
-- The rollup previously grouped by ISO (year, week). Drawing calendar month and
-- year columns off a weekly counter mis-files every week that straddles a month
-- boundary: the whole week is attributed to the calendar month of its Monday, so
-- the first days of a new month read zero until that month's first Monday. Corps
-- rank on these numbers, so month totals must follow the calendar exactly.
--
-- Regroup by UTC calendar day (`(occurred_at AT TIME ZONE 'UTC')::date`). The
-- reader (`src/lib/stats/activity.ts`) folds days into the selected week/month/
-- year bucket, all boundaries exact. Materialized views can't be ALTERed in
-- place, so drop + recreate. Source of truth: `src/db/views/activity_rollup.sql`.
--
-- Recreated `WITH NO DATA`; the hourly `activity-rollup-refresh` job (or the
-- first read) repopulates it. Rollback: 0052_activity_rollup_daily.rollback.sql.

DROP MATERIALIZED VIEW IF EXISTS "ap_activity_rollup";
--> statement-breakpoint
CREATE MATERIALIZED VIEW "ap_activity_rollup" AS
SELECT
  (occurred_at AT TIME ZONE 'UTC')::date       AS day,
  COALESCE(character_id, 0::bigint)            AS character_id,
  map_id,
  CASE
    WHEN kind = 'system.updated'
     AND (payload ? 'positionX' OR payload ? 'positionY')
     AND NOT (payload ?| ARRAY['alias', 'tag', 'status', 'intelNotes', 'locked', 'rallyAt'])
    THEN 'system.moved'
    ELSE kind
  END                                          AS kind,
  count(*)::int                                AS event_count
FROM "ap_map_event"
GROUP BY 1, 2, 3, 4
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "ap_activity_rollup_pk_idx"
  ON "ap_activity_rollup" (day, character_id, map_id, kind);
