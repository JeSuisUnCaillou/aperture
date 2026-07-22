-- Token store for the machine-to-machine `/api/integrations/*` route group
-- (docs/spec/integration-activity-stats.md). Each row is one issued token,
-- scoped to a single corporation — the tenant boundary every integration
-- route enforces. `token_hash` is a sha256 hex digest computed in app code
-- (src/lib/integrations/token.ts); the raw token is never stored.
--
-- Rollback: src/db/migrations/0058_integration_token.rollback.sql.

CREATE TABLE "ap_integration_token" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"corporation_id" bigint NOT NULL,
	"label" text NOT NULL,
	"allowed_scopes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "ap_integration_token_token_hash_unique" UNIQUE("token_hash")
);
