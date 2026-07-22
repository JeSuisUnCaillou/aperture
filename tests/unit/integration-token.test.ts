// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// resolveIntegrationToken's request-parsing/gating logic doesn't need a real
// row lookup — a single controllable mock row keeps this DB-free, mirroring
// the builder pattern in tests/unit/metrics-instrumentation.test.ts. The
// live-row / revoked-row round trip against real Postgres is covered by
// tests/integration/integration-activity-stats.test.ts.
const mockRow: {
  value: { tokenHash: string; corporationId: bigint; label: string; allowedScopes: string[] | null } | null;
} = { value: null };

vi.mock('@/db/client', () => {
  const builder: Record<string, unknown> = {};
  builder.from = () => builder;
  builder.where = () => builder;
  builder.then = (resolve: (rows: unknown[]) => unknown) =>
    resolve(mockRow.value ? [mockRow.value] : []);
  return { db: { select: () => builder } };
});

import {
  generateIntegrationToken,
  hashIntegrationToken,
  resolveIntegrationToken,
} from '@/lib/integrations/token';

function request(headers: Record<string, string> = {}, url = 'https://example.test/'): Request {
  return new Request(url, { headers });
}

describe('generateIntegrationToken / hashIntegrationToken', () => {
  it('generates distinct URL-safe tokens', () => {
    const a = generateIntegrationToken();
    const b = generateIntegrationToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes deterministically to a sha256 hex digest', () => {
    const raw = 'fixed-token-value';
    expect(hashIntegrationToken(raw)).toBe(hashIntegrationToken(raw));
    expect(hashIntegrationToken(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIntegrationToken(raw)).not.toBe(hashIntegrationToken('a-different-value'));
  });
});

describe('resolveIntegrationToken', () => {
  it('returns null with no Authorization header', async () => {
    mockRow.value = null;
    expect(await resolveIntegrationToken(request())).toBeNull();
  });

  it('returns null for a non-Bearer scheme', async () => {
    mockRow.value = null;
    expect(await resolveIntegrationToken(request({ authorization: 'Basic abc' }))).toBeNull();
  });

  it('returns null when no row matches the hash', async () => {
    mockRow.value = null;
    expect(await resolveIntegrationToken(request({ authorization: 'Bearer unknown-token' }))).toBeNull();
  });

  it('resolves the corporation for a matching token', async () => {
    const raw = 'my-raw-token';
    mockRow.value = {
      tokenHash: hashIntegrationToken(raw),
      corporationId: 98000001n,
      label: 'roster',
      allowedScopes: null,
    };
    const result = await resolveIntegrationToken(request({ authorization: `Bearer ${raw}` }));
    expect(result).toEqual({ corporationId: 98000001n, label: 'roster', allowedScopes: null });
  });

  it('ignores a ?token= query param — header is the only accepted transport', async () => {
    mockRow.value = {
      tokenHash: hashIntegrationToken('would-match'),
      corporationId: 98000001n,
      label: 'roster',
      allowedScopes: null,
    };
    const req = request({}, 'https://example.test/?token=would-match');
    expect(await resolveIntegrationToken(req)).toBeNull();
  });
});
