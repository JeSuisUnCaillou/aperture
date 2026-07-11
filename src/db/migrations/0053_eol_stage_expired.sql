-- Add a manual 'expired' end-of-life stage to `eol_stage` (GitHub issue #206).
--
-- Represents EVE's in-game "expiration imminent" / Expired state: a hole whose
-- guaranteed lifespan has ended and could collapse at any moment. Set manually
-- by scouts only (never auto-applied by Aperture) as the terminal fourth stage
-- of a wormhole's life: none -> eol (~4h) -> critical (~1h) -> expired. Unlike
-- eol/critical it drives no countdown and is skipped by the EOL-expiry reaper —
-- it is a persistent "do not jump" marker cleared only by a user.
--
-- Appended last so the existing ordinals are untouched; no code compares the
-- enum ordinally. Shared by ap_map_connection.eol_stage and
-- ap_map_signature.eol_stage.
--
-- Rollback: src/db/migrations/0053_eol_stage_expired.rollback.sql.

ALTER TYPE "public"."eol_stage" ADD VALUE IF NOT EXISTS 'expired';
