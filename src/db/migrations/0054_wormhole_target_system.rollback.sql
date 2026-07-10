-- Manual rollback for 0054_wormhole_target_system.sql.
--   psql "$DATABASE_URL" -f src/db/migrations/0054_wormhole_target_system.rollback.sql
ALTER TABLE "universe_wormhole" DROP CONSTRAINT IF EXISTS "universe_wormhole_target_system_id_universe_system_id_fk";--> statement-breakpoint
ALTER TABLE "universe_wormhole" DROP COLUMN IF EXISTS "target_system_id";
