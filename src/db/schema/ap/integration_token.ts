import { bigint, bigserial, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// One row per issued `/api/integrations/*` bearer token (see
// docs/spec/integration-activity-stats.md). `token_hash` is a sha256 hex
// digest (src/lib/integrations/token.ts); the raw token is shown once at mint
// time and never stored. `corporation_id` is the tenant boundary every
// integration route enforces — a token can only ever see activity on
// `type='corp'` maps owned by this corp. Revocation is `revoked_at` (non-null),
// not a row delete, so audit history survives.
export const apIntegrationToken = pgTable('ap_integration_token', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  corporationId: bigint('corporation_id', { mode: 'bigint' }).notNull(),
  label: text('label').notNull(),
  /** Reserved for future per-token scoping; not enforced yet. */
  allowedScopes: jsonb('allowed_scopes').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
