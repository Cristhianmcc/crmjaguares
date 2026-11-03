ALTER TABLE "quick_reply" ADD COLUMN IF NOT EXISTS "media_url" text;--> statement-breakpoint
ALTER TABLE "quick_reply" ADD COLUMN IF NOT EXISTS "media_name" text;--> statement-breakpoint
ALTER TABLE "quick_reply" ADD COLUMN IF NOT EXISTS "media_type" text;--> statement-breakpoint
ALTER TABLE "quick_reply" ADD COLUMN IF NOT EXISTS "media_size" integer;

