-- 0027 — Campañas masivas de WhatsApp (Jaguares)
-- Renovación mensual + avisos operativos
-- Dos tipos: renovacion (aviso de pago) y aviso (comunicado operativo)

CREATE TABLE "campaign" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "tipo" text NOT NULL CHECK ("tipo" IN ('renovacion', 'aviso')),
  "nombre" text NOT NULL,
  "mensaje" text NOT NULL,
  "status" text NOT NULL DEFAULT 'borrador'
    CHECK ("status" IN ('borrador', 'enviando', 'enviada', 'cancelada')),
  "sent_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0,
  "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "scheduled_at" timestamp,
  "started_at" timestamp,
  "finished_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "campaign_org_status_idx"
  ON "campaign" ("organization_id", "status", "created_at");
