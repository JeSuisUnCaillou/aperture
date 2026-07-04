-- Rollback of 0052_activity_rollup_daily.sql — restore the ISO-week grain
-- (the 0023 shape). Recreated `WITH NO DATA`; repopulated by the hourly
-- `activity-rollup-refresh` job or the first read.

DROP MATERIALIZED VIEW IF EXISTS "ap_activity_rollup";
--> statement-breakpoint
CREATE MATERIALIZED VIEW "ap_activity_rollup" AS
SELECT
  EXTRACT(ISOYEAR FROM occurred_at)::int      AS iso_year,
  EXTRACT(WEEK    FROM occurred_at)::int      AS iso_week,
  COALESCE(character_id, 0::bigint)           AS character_id,
  map_id,
  CASE
    WHEN kind = 'system.updated'
     AND (payload ? 'positionX' OR payload ? 'positionY')
     AND NOT (payload ?| ARRAY['alias', 'tag', 'status', 'intelNotes', 'locked', 'rallyAt'])
    THEN 'system.moved'
    ELSE kind
  END                                         AS kind,
  count(*)::int                               AS event_count
FROM "ap_map_event"
GROUP BY 1, 2, 3, 4, 5
WITH NO DATA;
--> statement-breakpoint
CREATE UNIQUE INDEX "ap_activity_rollup_pk_idx"
  ON "ap_activity_rollup" (iso_year, iso_week, character_id, map_id, kind);
