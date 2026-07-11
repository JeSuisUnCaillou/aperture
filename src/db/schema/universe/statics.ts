import { integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { universeSystem } from './geography';
import { universeType } from './items';

export const universeSystemStatic = pgTable(
  'universe_system_static',
  {
    systemId: integer('system_id')
      .notNull()
      .references(() => universeSystem.id, { onDelete: 'cascade' }),
    typeId: integer('type_id')
      .notNull()
      .references(() => universeType.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.systemId, t.typeId] })],
);

// Hand-maintained wormhole routing catalog. The source/target class labels are
// absent from the SDE and ESI; mass, lifetime, and scan strength stay
// dogma-sourced via universe_type_attribute_effective. source_classes is the
// set of system classes a hole can spawn in (e.g. S199 in {LS, NS}); null =
// source unspecified — the universal K162 reverse-exit plus the
// Drifter/shattered-access holes whose source class isn't in Aperture's
// vocabulary. null target_class = resolved from the far side. target_system_id
// pins the exact destination system for fixed-destination holes (J377 → Turnur)
// — a refinement layered on target_class, which stays true; null for every
// normal hole whose destination is unknown until the far side is scanned.
export const universeWormhole = pgTable('universe_wormhole', {
  typeId: integer('type_id')
    .primaryKey()
    .references(() => universeType.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sourceClasses: text('source_classes').array(),
  targetClass: text('target_class'),
  targetSystemId: integer('target_system_id').references(() => universeSystem.id, {
    onDelete: 'restrict',
  }),
});
