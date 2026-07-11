-- Recreate eol_stage without 'expired'; existing 'expired' rows fall back to
-- 'critical' (the nearest surviving stage).
UPDATE "ap_map_connection" SET "eol_stage" = 'critical' WHERE "eol_stage" = 'expired';--> statement-breakpoint
UPDATE "ap_map_signature" SET "eol_stage" = 'critical' WHERE "eol_stage" = 'expired';--> statement-breakpoint
ALTER TABLE "ap_map_connection" ALTER COLUMN "eol_stage" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ap_map_signature" ALTER COLUMN "eol_stage" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."eol_stage" RENAME TO "eol_stage_old";--> statement-breakpoint
CREATE TYPE "public"."eol_stage" AS ENUM('none', 'eol', 'critical');--> statement-breakpoint
ALTER TABLE "ap_map_connection" ALTER COLUMN "eol_stage" TYPE "public"."eol_stage" USING "eol_stage"::text::"public"."eol_stage";--> statement-breakpoint
ALTER TABLE "ap_map_signature" ALTER COLUMN "eol_stage" TYPE "public"."eol_stage" USING "eol_stage"::text::"public"."eol_stage";--> statement-breakpoint
ALTER TABLE "ap_map_connection" ALTER COLUMN "eol_stage" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "ap_map_signature" ALTER COLUMN "eol_stage" SET DEFAULT 'none';--> statement-breakpoint
DROP TYPE "public"."eol_stage_old";
