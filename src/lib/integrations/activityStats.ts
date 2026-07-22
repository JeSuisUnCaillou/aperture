import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { apMap } from '@/db/schema';
import {
  activityKindExclusion,
  bucketStart,
  emptyTriplet,
  KIND_MAP,
  toISODate,
  type ActivityTriplet,
} from '@/lib/stats/activityShaping';

/**
 * Per-character activity projection over `ap_activity_rollup`, scoped to one
 * token's corporation, for `POST /api/integrations/activity-stats`
 * (docs/spec/integration-activity-stats.md). Shares `KIND_MAP` and the
 * `map.%`/`system.moved` exclusions with `src/lib/stats/activity.ts` via
 * `activityShaping.ts`, but differs from that reader in two deliberate ways:
 *
 *   - **No main-character attribution** — returns raw acting `character_id`
 *     counts; consumers own their own alt-identity graph.
 *   - **Caller-defined window + granularity** — buckets `[from, to]` by
 *     `weekly` (Monday, UTC) or `daily` period, not 12 fixed trailing buckets.
 */

export interface IntegrationActivityBucket {
  bucketStart: string;
  system: ActivityTriplet;
  connection: ActivityTriplet;
  signature: ActivityTriplet;
}

export interface IntegrationCharacterActivity {
  characterId: number;
  buckets: IntegrationActivityBucket[];
}

export interface IntegrationActivityStatsResponse {
  generatedAt: string;
  granularity: 'weekly' | 'daily';
  coverage: { earliest: string | null; latest: string | null };
  characters: IntegrationCharacterActivity[];
}

type AggRow = {
  character_id: string;
  day: string;
  kind: string;
  total: number;
};

type CoverageRow = {
  earliest: string | null;
  latest: string | null;
};

/**
 * Loads activity for `characterIds`, scoped strictly to `corporationId`'s
 * `type='corp'` maps — the tenant boundary a token can never see past. Every
 * requested id appears in `characters` (request order); a character with no
 * activity in scope/range gets `buckets: []`, never omitted.
 */
export async function loadIntegrationActivityStats(input: {
  corporationId: bigint;
  characterIds: bigint[];
  from?: string;
  to?: string;
  granularity: 'weekly' | 'daily';
}): Promise<IntegrationActivityStatsResponse> {
  const { corporationId, characterIds, granularity } = input;
  const generatedAt = new Date().toISOString();
  const toDate = input.to ?? toISODate(new Date());
  const period = granularity === 'weekly' ? 'week' : 'day';

  const emptyResult = (): IntegrationActivityStatsResponse => ({
    generatedAt,
    granularity,
    coverage: { earliest: null, latest: null },
    characters: characterIds.map((id) => ({ characterId: Number(id), buckets: [] })),
  });

  const maps = await db
    .select({ id: apMap.id })
    .from(apMap)
    .where(
      and(
        eq(apMap.type, 'corp'),
        eq(apMap.ownerCorporationId, corporationId),
        isNull(apMap.deletedAt),
      ),
    );
  const mapIds = maps.map((m) => m.id);
  if (mapIds.length === 0) return emptyResult();

  const mapIdList = sql.join(
    mapIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const charIdList = sql.join(
    characterIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const kindExclusion = activityKindExclusion(sql.raw('r.kind'));

  const [coverageResult, aggResult] = await Promise.all([
    db.execute<CoverageRow>(sql`
      SELECT
        to_char(min(r.day), 'YYYY-MM-DD') AS earliest,
        to_char(max(r.day), 'YYYY-MM-DD') AS latest
      FROM ap_activity_rollup r
      WHERE r.map_id IN (${mapIdList})
        AND ${kindExclusion}
    `),
    db.execute<AggRow>(sql`
      SELECT
        r.character_id::text         AS character_id,
        to_char(r.day, 'YYYY-MM-DD') AS day,
        r.kind                       AS kind,
        SUM(r.event_count)::int      AS total
      FROM ap_activity_rollup r
      WHERE r.map_id IN (${mapIdList})
        AND r.character_id IN (${charIdList})
        AND ${kindExclusion}
        ${input.from ? sql`AND r.day >= ${input.from}::date` : sql``}
        AND r.day <= ${toDate}::date
      GROUP BY 1, 2, 3
    `),
  ]);

  const coverage = coverageResult.rows[0] ?? { earliest: null, latest: null };

  interface Bucket {
    system: ActivityTriplet;
    connection: ActivityTriplet;
    signature: ActivityTriplet;
  }
  const byCharacter = new Map<string, Map<string, Bucket>>();

  for (const row of aggResult.rows) {
    const mapped = KIND_MAP[row.kind];
    if (!mapped) continue;
    const [group, action] = mapped;
    const key = toISODate(bucketStart(new Date(`${row.day}T00:00:00Z`), period));

    let charBuckets = byCharacter.get(row.character_id);
    if (!charBuckets) {
      charBuckets = new Map();
      byCharacter.set(row.character_id, charBuckets);
    }
    let bucket = charBuckets.get(key);
    if (!bucket) {
      bucket = { system: emptyTriplet(), connection: emptyTriplet(), signature: emptyTriplet() };
      charBuckets.set(key, bucket);
    }
    bucket[group][action] += row.total;
  }

  const characters: IntegrationCharacterActivity[] = characterIds.map((id) => {
    const charBuckets = byCharacter.get(id.toString());
    const buckets: IntegrationActivityBucket[] = charBuckets
      ? [...charBuckets.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([start, b]) => ({ bucketStart: start, ...b }))
      : [];
    return { characterId: Number(id), buckets };
  });

  return { generatedAt, granularity, coverage, characters };
}
