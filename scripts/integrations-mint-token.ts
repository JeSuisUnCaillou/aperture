// Mints, lists, and drops bearer tokens for the `/api/integrations/*` route
// group (see docs/spec/integration-activity-stats.md). Minting prints the raw
// token once — only its sha256 hash is persisted
// (`ap_integration_token.token_hash`), so a lost token cannot be recovered;
// mint a new one and drop the old row instead. Dropping sets `revoked_at`
// rather than deleting the row, so audit history survives.
//
// Usage:
//   pnpm integrations:mint-token mint --corp <corporationId> --label <name> [--scopes a,b]
//   pnpm integrations:mint-token list-tokens [--corp <corporationId>]
//   pnpm integrations:mint-token drop-token --id <tokenId>
import { desc, eq } from 'drizzle-orm';
import { db, pool } from '@/db/client';
import { apIntegrationToken } from '@/db/schema';
import { generateIntegrationToken, hashIntegrationToken } from '@/lib/integrations/token';

const USAGE = `Usage:
  pnpm integrations:mint-token mint --corp <corporationId> --label <name> [--scopes a,b]
  pnpm integrations:mint-token list-tokens [--corp <corporationId>]
  pnpm integrations:mint-token drop-token --id <tokenId>`;

function readFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

function usageError(): never {
  console.error(USAGE);
  process.exit(1);
}

async function mint() {
  const corpArg = readFlag('corp');
  const label = readFlag('label')?.trim();
  const scopesArg = readFlag('scopes');

  if (!corpArg || !/^\d+$/.test(corpArg) || !label) usageError();

  const corporationId = BigInt(corpArg);
  const allowedScopes = scopesArg
    ? scopesArg.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  const raw = generateIntegrationToken();
  await db.insert(apIntegrationToken).values({
    tokenHash: hashIntegrationToken(raw),
    corporationId,
    label,
    allowedScopes,
  });

  console.log(`Token minted for corp ${corporationId}, label "${label}".`);
  console.log('');
  console.log(raw);
  console.log('');
  console.log('Store this now — it is shown once and cannot be recovered.');
}

async function listTokens() {
  const corpArg = readFlag('corp');
  if (corpArg !== undefined && !/^\d+$/.test(corpArg)) usageError();

  const rows = await db
    .select({
      id: apIntegrationToken.id,
      corporationId: apIntegrationToken.corporationId,
      label: apIntegrationToken.label,
      allowedScopes: apIntegrationToken.allowedScopes,
      createdAt: apIntegrationToken.createdAt,
      revokedAt: apIntegrationToken.revokedAt,
    })
    .from(apIntegrationToken)
    .where(corpArg ? eq(apIntegrationToken.corporationId, BigInt(corpArg)) : undefined)
    .orderBy(desc(apIntegrationToken.createdAt));

  if (rows.length === 0) {
    console.log('No tokens found.');
    return;
  }

  for (const row of rows) {
    const status = row.revokedAt ? `revoked ${row.revokedAt.toISOString()}` : 'active';
    const scopes = row.allowedScopes?.length ? row.allowedScopes.join(',') : '(all)';
    console.log(
      `#${row.id}  corp ${row.corporationId}  "${row.label}"  scopes=${scopes}  created ${row.createdAt.toISOString()}  ${status}`,
    );
  }
}

async function dropToken() {
  const idArg = readFlag('id');
  if (!idArg || !/^\d+$/.test(idArg)) usageError();

  const id = BigInt(idArg);
  const [existing] = await db
    .select({ id: apIntegrationToken.id, label: apIntegrationToken.label, revokedAt: apIntegrationToken.revokedAt })
    .from(apIntegrationToken)
    .where(eq(apIntegrationToken.id, id));

  if (!existing) {
    console.error(`No token with id ${id}.`);
    process.exit(1);
  }
  if (existing.revokedAt) {
    console.log(`Token #${existing.id} ("${existing.label}") was already dropped on ${existing.revokedAt.toISOString()}.`);
    return;
  }

  await db
    .update(apIntegrationToken)
    .set({ revokedAt: new Date() })
    .where(eq(apIntegrationToken.id, id));

  console.log(`Token #${existing.id} ("${existing.label}") dropped.`);
}

async function main() {
  const command = process.argv[2];
  switch (command) {
    case 'mint':
      return mint();
    case 'list-tokens':
      return listTokens();
    case 'drop-token':
      return dropToken();
    default:
      return usageError();
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('integrations:mint-token failed:', err);
    process.exit(1);
  });
