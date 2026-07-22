import 'server-only';
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { resolveIntegrationToken } from '@/lib/integrations/token';
import { loadIntegrationActivityStats } from '@/lib/integrations/activityStats';
import { withApiMetrics } from '@/lib/metrics/httpInstrumentation';
import { apertureConfig } from '../../../../../aperture.config';

/**
 * POST /api/integrations/activity-stats
 *
 * Machine-to-machine, token-authenticated per-character map-activity feed
 * (docs/spec/integration-activity-stats.md). Body:
 * { characterIds, from?, to?, granularity? }. Returns
 * { generatedAt, granularity, coverage, characters }.
 *
 * Access: `Authorization: Bearer <token>` resolving to a corporation
 * (`ap_integration_token`) — every returned row is scoped to that corp's
 * `type='corp'` maps. Gated behind `INTEGRATIONS_ENABLED` (404 when off).
 */

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const activityStatsBodySchema = z.object({
  characterIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(apertureConfig.INTEGRATION_MAX_CHARACTER_IDS),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  granularity: z.enum(['weekly', 'daily']).default('weekly'),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiMetrics(
  '/api/integrations/activity-stats',
  async function POST(request: NextRequest) {
    if (!env.INTEGRATIONS_ENABLED) {
      return Response.json({ error: 'Not found.' }, { status: 404 });
    }

    const token = await resolveIntegrationToken(request);
    if (!token) {
      return Response.json(
        { error: 'Unauthorized.' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const parsed = activityStatsBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        { status: 400 },
      );
    }

    const result = await loadIntegrationActivityStats({
      corporationId: token.corporationId,
      characterIds: parsed.data.characterIds.map((id) => BigInt(id)),
      from: parsed.data.from,
      to: parsed.data.to,
      granularity: parsed.data.granularity,
    });

    return Response.json(result);
  },
);
