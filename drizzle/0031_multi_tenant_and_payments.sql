ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_order" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE cascade,
  "plan_id" text NOT NULL,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'PEN',
  "status" text NOT NULL DEFAULT 'pending',
  "checkout_token" text,
  "payment_id" text,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_org_idx" ON "payment_order" ("organization_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_order_payment_id_idx" ON "payment_order" ("payment_id");
