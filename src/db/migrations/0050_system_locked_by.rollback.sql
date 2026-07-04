-- Manual rollback for 0050_system_locked_by.sql.
--   psql "$DATABASE_URL" -f src/db/migrations/0050_system_locked_by.rollback.sql
ALTER TABLE "ap_map_system" DROP CONSTRAINT IF EXISTS "ap_map_system_locked_by_character_id_ap_character_id_fk";--> statement-breakpoint
ALTER TABLE "ap_map_system" DROP COLUMN IF EXISTS "locked_by_character_id";
