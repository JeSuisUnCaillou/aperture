import 'server-only';
import { type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { resolveSignatureDestination } from '@/lib/map/fixedDestination';
import { parseBigInt, requireMapMutate } from '../../../../utils';
import { withApiMetrics } from '@/lib/metrics/httpInstrumentation';

/**
 * POST /api/map/[mapId]/signatures/[sigId]/resolve-destination — fold the
 * wormhole type's fixed destination (e.g. J377 → Turnur) onto the map from the
 * signature side. Returns the committed event payloads + the connection id
 * (`{ ok, data: { payloads, connectionId }, eventId: 0 }`) so the client folds,
 * dedupes, and links the signature to the connection.
 *
 * [sigId] is `ap_map_signature.id` (the DB row id), not the in-game sig code.
 * The destination is resolved server-side from the sig's type, so a client can
 * never force a resolve from a non-pinned hole. No request body.
 *
 * Access: `map_update` right (a content edit — placing a node + connection).
 */

export const runtime = 'nodejs';

export const POST = withApiMetrics(
  '/api/map/:mapId/signatures/:sigId/resolve-destination',
  async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ mapId: string; sigId: string }> },
  ) {
    const session = await getSession();
    const { mapId: rawMapId, sigId: rawSigId } = await params;
    const guard = await requireMapMutate(rawMapId, session, 'map_update');
    if (!guard.ok) {
      return Response.json({ ok: false, error: guard.error }, { status: guard.status });
    }

    const sigId = parseBigInt(rawSigId);
    if (!sigId) return Response.json({ ok: false, error: 'Invalid signature id.' }, { status: 400 });

    const result = await resolveSignatureDestination({
      mapId: guard.mapId,
      sigId,
      characterId: guard.characterId,
    });

    return Response.json(result, { status: result.ok ? 200 : 400 });
  },
);
