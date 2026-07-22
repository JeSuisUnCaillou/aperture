import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { apIntegrationToken } from '@/db/schema';

/**
 * Bearer-token auth for the `/api/integrations/*` route group
 * (docs/spec/integration-activity-stats.md). Each token resolves to exactly
 * one corporation — the tenant boundary every route in the group enforces.
 * Raw tokens are never stored; only a sha256 hash lives in
 * `ap_integration_token`, mirroring the `AES`-only precedent in
 * `src/lib/crypto.ts` (no pgcrypto — hashing happens in Node).
 *
 * No `import 'server-only'`: `scripts/integrations-mint-token.ts` imports this
 * module directly under bare `tsx`, which has no bundler alias for the
 * `server-only` package and crashes on it (unlike Next's webpack build).
 */

export interface ResolvedIntegrationToken {
  corporationId: bigint;
  label: string;
  allowedScopes: string[] | null;
}

/** A fresh, URL-safe raw token. Used by the mint script; never persisted as-is. */
export function generateIntegrationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex digest of a raw token — the only form stored in the DB. */
export function hashIntegrationToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * Resolves an inbound request's `Authorization: Bearer <token>` header to its
 * issuing corporation, or `null` if the header is missing or the token is
 * unknown/revoked. Unlike `/api/metrics`, does **not** fall back to `?token=`
 * — these responses carry member PII-adjacent activity and must not depend on
 * a token landing in a URL/log line.
 */
export async function resolveIntegrationToken(
  request: Request,
): Promise<ResolvedIntegrationToken | null> {
  const raw = extractBearerToken(request);
  if (!raw) return null;
  const hash = hashIntegrationToken(raw);

  const [row] = await db
    .select({
      tokenHash: apIntegrationToken.tokenHash,
      corporationId: apIntegrationToken.corporationId,
      label: apIntegrationToken.label,
      allowedScopes: apIntegrationToken.allowedScopes,
    })
    .from(apIntegrationToken)
    .where(and(eq(apIntegrationToken.tokenHash, hash), isNull(apIntegrationToken.revokedAt)));
  if (!row) return null;

  // Constant-time confirmation of the indexed-hash lookup, matching the
  // `/api/metrics` comparison discipline (`node:crypto` `timingSafeEqual`).
  const a = Buffer.from(hash);
  const b = Buffer.from(row.tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    corporationId: row.corporationId,
    label: row.label,
    allowedScopes: row.allowedScopes ?? null,
  };
}
