## token.ts

**Purpose:** Bearer-token auth for the `/api/integrations/*` route group — resolves a token to its issuing corporation.
**File:** `src/lib/integrations/token.ts`

---

### generateIntegrationToken(): string
A fresh, URL-safe raw token (`randomBytes(32)` base64url). Used only by the mint script; the raw value is never persisted.

---

### hashIntegrationToken(raw: string): string
sha256 hex digest of a raw token — the only form stored in `ap_integration_token.token_hash`.

---

### resolveIntegrationToken(request: Request): Promise<ResolvedIntegrationToken | null>
Reads `Authorization: Bearer <token>`, hashes it, and looks up the matching non-revoked `ap_integration_token` row. Returns `null` when the header is missing/malformed or the token is unknown/revoked. Does **not** fall back to a `?token=` query param (unlike `/api/metrics`) — these responses carry member PII-adjacent activity, which must not depend on a token landing in a URL or log line.

**Returns:** `{ corporationId: bigint; label: string; allowedScopes: string[] | null }` — `corporationId` is the tenant boundary every integration route scopes its response to.

### Notes
No `import 'server-only'` — `scripts/integrations-mint-token.ts` imports this module under bare `tsx`, which has no bundler alias for the `server-only` package.
