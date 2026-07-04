-- Signature EOL intent — `ap_map_signature.eol_stage` (GitHub issue #199).
--
-- Records the end-of-life stage a pilot set on a wormhole signature before
-- jumping it, when no connection exists yet to carry the state. On populate (the
-- sig is bound to its connection) the stage is transferred onto
-- `ap_map_connection.eol_stage`, mirroring how the connection's jump-mass size is
-- auto-set from the sig type. Reuses the connection's three-stage `eol_stage`
-- enum (`none`/`eol`/`critical`) so the sig panel and the connection offer the
-- same control. Defaults `none`. Only meaningful for `group_key = 'wormhole'` rows.
--
-- Rollback: src/db/migrations/0051_signature_eol.rollback.sql.

ALTER TABLE "ap_map_signature" ADD COLUMN "eol_stage" "eol_stage" DEFAULT 'none' NOT NULL;
