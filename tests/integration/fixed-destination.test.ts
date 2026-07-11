// @vitest-environment node
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, pool } from '@/db/client';
import {
  apMap,
  apMapConnection,
  apMapEvent,
  apMapSignature,
  apMapSystem,
  universeCategory,
  universeConstellation,
  universeGroup,
  universeRegion,
  universeSystem,
  universeType,
  universeWormhole,
} from '@/db/schema';
import { resolveSignatureDestination } from '@/lib/map/fixedDestination';

/**
 * Fixed-destination resolve (e.g. J377 → Turnur): places the pinned destination
 * node + a `wh` connection from a wormhole sig, idempotently, and refuses a hole
 * with no fixed destination.
 *
 *   docker compose up -d && pnpm db:migrate && RUN_DB_TESTS=1 pnpm test
 */
const run = process.env.RUN_DB_TESTS === '1';

const REGION = 98045001;
const CONSTELLATION = 98045001;
const SRC_SYS = 98045002; // system the sig is scanned in
const DEST_SYS = 98045006; // the pinned destination (Turnur-like lowsec)
const CATEGORY = 98045010;
const GROUP = 98045011;
const J377_TYPE = 98045020; // fixed-destination hole → DEST_SYS
const K162_TYPE = 98045021; // no fixed destination

const MAP_NAME = 'Fixed Destination Test Map';
let mapId = 0n;
let srcMapSystemId = 0n;
let j377SigId = 0n;
let k162SigId = 0n;

describe.skipIf(!run)('fixed-destination resolve (real Postgres)', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: 'src/db/migrations' });
    await cleanup();

    await db.insert(universeRegion).values({ id: REGION, name: 'FD Test Region' });
    await db
      .insert(universeConstellation)
      .values({ id: CONSTELLATION, regionId: REGION, name: 'FD Test Const' });
    await db.insert(universeSystem).values([
      { id: SRC_SYS, constellationId: CONSTELLATION, name: 'J160200', security: 'C3' },
      { id: DEST_SYS, constellationId: CONSTELLATION, name: 'Turnur', security: 'L' },
    ]);
    await db.insert(universeCategory).values({ id: CATEGORY, name: 'FD Test Category' });
    await db.insert(universeGroup).values({ id: GROUP, categoryId: CATEGORY, name: 'FD Test Group' });
    await db.insert(universeType).values([
      { id: J377_TYPE, groupId: GROUP, name: 'J377' },
      { id: K162_TYPE, groupId: GROUP, name: 'K162' },
    ]);
    await db.insert(universeWormhole).values([
      { typeId: J377_TYPE, name: 'J377', sourceClasses: null, targetClass: 'L', targetSystemId: DEST_SYS },
      { typeId: K162_TYPE, name: 'K162', sourceClasses: null, targetClass: null, targetSystemId: null },
    ]);

    const [m] = await db
      .insert(apMap)
      .values({ name: MAP_NAME, scope: 'all', type: 'private' })
      .returning({ id: apMap.id });
    mapId = m!.id;

    const [sys] = await db
      .insert(apMapSystem)
      .values({ mapId, systemId: SRC_SYS, visible: true, positionX: 0, positionY: 0 })
      .returning({ id: apMapSystem.id });
    srcMapSystemId = sys!.id;

    const [j377, k162] = await db
      .insert(apMapSignature)
      .values([
        {
          mapSystemId: srcMapSystemId,
          sigId: 'AAA',
          groupKey: 'wormhole',
          typeId: J377_TYPE,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
        {
          mapSystemId: srcMapSystemId,
          sigId: 'BBB',
          groupKey: 'wormhole',
          typeId: K162_TYPE,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      ])
      .returning({ id: apMapSignature.id });
    j377SigId = j377!.id;
    k162SigId = k162!.id;
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('places the destination node + wh connection, then is idempotent', async () => {
    const first = await resolveSignatureDestination({ mapId, sigId: j377SigId, characterId: null });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // One system.added (Turnur) + one connection.create.
    expect(first.data.payloads).toHaveLength(2);
    expect(first.data.connectionId).toMatch(/^\d+$/);

    const systems = await db
      .select({ systemId: apMapSystem.systemId })
      .from(apMapSystem)
      .where(and(eq(apMapSystem.mapId, mapId), eq(apMapSystem.visible, true)));
    expect(new Set(systems.map((s) => s.systemId))).toEqual(new Set([SRC_SYS, DEST_SYS]));

    const conns = await db
      .select({ scope: apMapConnection.scope, massStatus: apMapConnection.massStatus })
      .from(apMapConnection)
      .where(eq(apMapConnection.mapId, mapId));
    expect(conns).toHaveLength(1);
    expect(conns[0]).toMatchObject({ scope: 'wh', massStatus: 'fresh' });

    // Re-resolving is a no-op: no new node/edge, and the same connection id.
    const second = await resolveSignatureDestination({ mapId, sigId: j377SigId, characterId: null });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.payloads).toHaveLength(0);
    expect(second.data.connectionId).toBe(first.data.connectionId);

    const connsAfter = await db
      .select({ id: apMapConnection.id })
      .from(apMapConnection)
      .where(eq(apMapConnection.mapId, mapId));
    expect(connsAfter).toHaveLength(1);
  });

  it('refuses a hole with no fixed destination (one-directional guard)', async () => {
    const result = await resolveSignatureDestination({ mapId, sigId: k162SigId, characterId: null });
    expect(result.ok).toBe(false);
  });

  it('refuses a signature that is not on the map', async () => {
    const result = await resolveSignatureDestination({ mapId, sigId: 999_999_999n, characterId: null });
    expect(result.ok).toBe(false);
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (mapId) {
    await db.delete(apMapConnection).where(eq(apMapConnection.mapId, mapId));
    await db.delete(apMapSignature).where(eq(apMapSignature.mapSystemId, srcMapSystemId));
    await db.delete(apMapSystem).where(eq(apMapSystem.mapId, mapId));
    await db.delete(apMapEvent).where(eq(apMapEvent.mapId, mapId));
  }
  await db.delete(apMap).where(eq(apMap.name, MAP_NAME));
  await db.delete(universeWormhole).where(inArray(universeWormhole.typeId, [J377_TYPE, K162_TYPE]));
  await db.delete(universeType).where(inArray(universeType.id, [J377_TYPE, K162_TYPE]));
  await db.delete(universeGroup).where(eq(universeGroup.id, GROUP));
  await db.delete(universeCategory).where(eq(universeCategory.id, CATEGORY));
  await db.delete(universeSystem).where(inArray(universeSystem.id, [SRC_SYS, DEST_SYS]));
  await db.delete(universeConstellation).where(eq(universeConstellation.id, CONSTELLATION));
  await db.delete(universeRegion).where(eq(universeRegion.id, REGION));
}
