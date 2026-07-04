-- Manual rollback for 0051_signature_eol.sql.
--   psql "$DATABASE_URL" -f src/db/migrations/0051_signature_eol.rollback.sql
ALTER TABLE "ap_map_signature" DROP COLUMN IF EXISTS "eol_stage";
