-- Manual rollback for 0058_integration_token.sql.
--   psql "$DATABASE_URL" -f src/db/migrations/0058_integration_token.rollback.sql
DROP TABLE IF EXISTS "ap_integration_token";
