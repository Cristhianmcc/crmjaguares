ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "rubro" text NOT NULL DEFAULT 'servicios';--> statement-breakpoint
UPDATE "organization" SET "rubro" = 'escuela' WHERE "name" ILIKE '%jaguares%' OR "name" ILIKE '%monterrial%';

