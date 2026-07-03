-- Lock attribution — `ap_map_system.locked_by_character_id` (GitHub issue #197).
--
-- Records who currently holds a system's lock so the inspector can show the
-- locker's name next to the Locked checkbox, without a director-only audit-log
-- dive. Stamped with the acting character when `locked` flips true and NULLed
-- when it flips false. `ON DELETE SET NULL` so erasing a character does not
-- cascade-wipe the systems they locked. Nullable: an unlocked system has no
-- locker. Existing locked rows backfill to NULL (locker unknown until the next
-- lock toggle) — no data to recover the original actor from.
--
-- Rollback: src/db/migrations/0050_system_locked_by.rollback.sql.

ALTER TABLE "ap_map_system" ADD COLUMN "locked_by_character_id" bigint;--> statement-breakpoint
ALTER TABLE "ap_map_system" ADD CONSTRAINT "ap_map_system_locked_by_character_id_ap_character_id_fk" FOREIGN KEY ("locked_by_character_id") REFERENCES "public"."ap_character"("id") ON DELETE set null ON UPDATE no action;
