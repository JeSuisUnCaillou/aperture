-- Fixed-destination wormholes — `universe_wormhole.target_system_id`.
--
-- Some wormhole types always exit to one specific system rather than merely a
-- security class (J377 → Turnur is the first). Records that exact far-end
-- system, refining `target_class` without replacing it (the class stays true).
-- NULL for every normal hole — the destination is genuinely unknown until the
-- far side is scanned; set only for fixed-destination types. The value itself
-- is universe_* data seeded through the CSV ingest, not this migration, which
-- ships an empty column. `ON DELETE RESTRICT` so a referenced universe_system
-- can't be deleted out from under the catalog.
--
-- Rollback: src/db/migrations/0054_wormhole_target_system.rollback.sql.

ALTER TABLE "universe_wormhole" ADD COLUMN "target_system_id" integer;--> statement-breakpoint
ALTER TABLE "universe_wormhole" ADD CONSTRAINT "universe_wormhole_target_system_id_universe_system_id_fk" FOREIGN KEY ("target_system_id") REFERENCES "public"."universe_system"("id") ON DELETE restrict ON UPDATE no action;
