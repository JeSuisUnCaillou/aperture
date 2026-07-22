## integrations-mint-token.ts

**Purpose:** CLI entry point (`pnpm integrations:mint-token`) that mints, lists, and drops bearer tokens for the `/api/integrations/*` route group.
**File:** `scripts/integrations-mint-token.ts`

Subcommands (first positional arg):
- `mint --corp <corporationId> --label <name> [--scopes a,b]` — generates a random raw token (`generateIntegrationToken`), inserts one `ap_integration_token` row keyed by its sha256 hash (`hashIntegrationToken`, `corporationId`, `label`, optional `allowedScopes`), and prints the raw token **once** — only the hash is persisted, so a lost token can't be recovered; mint a new one and drop the old row instead.
- `list-tokens [--corp <corporationId>]` — prints one line per `ap_integration_token` row (id, corp, label, scopes, created-at, active/dropped status), newest first. Omit `--corp` to list across all corporations.
- `drop-token --id <tokenId>` — sets `revoked_at` on the token row (does not delete it, so audit history survives). A no-op with a notice if the token is already dropped.

Exits `1` on missing/malformed flags, an unknown/missing subcommand, a `drop-token --id` that matches no row, or a DB error.
