## integration_token.ts

**Purpose:** The `ap_integration_token` table — issued bearer tokens for the machine-to-machine `/api/integrations/*` route group, each scoped to one corporation.
**File:** `src/db/schema/ap/integration_token.ts`

---

### apIntegrationToken
`pgTable('ap_integration_token', …)`:
- `id` — `bigserial` PK.
- `token_hash` — `text`, required, unique. sha256 hex digest of the raw token; the raw value is shown once at mint time and never stored.
- `corporation_id` — `bigint`, required. No FK (matches `ap_map.owner_corporation_id`). The tenant boundary every integration route scopes activity to.
- `label` — `text`, required. Human-readable consumer name.
- `allowed_scopes` — `jsonb` (`string[]`), nullable. Reserved for future per-token scoping; not enforced yet.
- `created_at` — `timestamptz`, default `now()`.
- `revoked_at` — `timestamptz`, nullable. Non-null = revoked; a revoked token is excluded at lookup. Revocation is this column, not a row delete, so audit history survives (no `active` boolean per CLAUDE.md lifecycle rule).

Minted by `scripts/integrations-mint-token.ts`; resolved by `resolveIntegrationToken` (`src/lib/integrations/token.ts`).
