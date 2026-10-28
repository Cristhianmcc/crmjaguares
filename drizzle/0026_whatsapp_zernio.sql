-- 026 — WhatsApp por Zernio: las tres columnas que identifican y validan
-- una conexión de WhatsApp que viaja por la API unificada de Zernio en vez
-- de la Cloud API de Meta directamente.
--
-- `source` distingue el transporte: 'meta' (Cloud API) o 'zernio'. Default
-- 'meta' para que las conexiones existentes sigan funcionando sin retoque.
--
-- `account_ref` es el `account.id` del webhook de Zernio: es lo que enruta
-- el mensaje entrante a la organización que corresponde.
--
-- `webhook_secret` es el HMAC-SHA256 con el que Zernio firma sus entregas.
-- Sin él la firma no se valida y solo protege el segmento secreto de la URL.
--
-- `waba_id` y `phone_number_id` ya eran NOT NULL; aquí se hacen opcionales
-- porque con Zernio el número lo administra Zernio, no Meta.
ALTER TABLE "meta_credentials" ALTER COLUMN "waba_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ALTER COLUMN "phone_number_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'meta' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN IF NOT EXISTS "account_ref" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN IF NOT EXISTS "webhook_secret" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_credentials_account_ref_idx" ON "meta_credentials" USING btree ("account_ref");
