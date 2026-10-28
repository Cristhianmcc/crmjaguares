import postgres from "postgres";

const url = "postgresql://postgres:postgres@localhost:5433/jaguares";
const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS campaign (
      id text PRIMARY KEY NOT NULL,
      organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
      tipo text NOT NULL CHECK (tipo IN ('renovacion', 'aviso')),
      nombre text NOT NULL,
      mensaje text NOT NULL,
      status text NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','enviando','enviada','cancelada')),
      sent_count integer NOT NULL DEFAULT 0,
      error_count integer NOT NULL DEFAULT 0,
      created_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
      scheduled_at timestamp,
      started_at timestamp,
      finished_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await sql.unsafe(
    "CREATE INDEX IF NOT EXISTS campaign_org_status_idx ON campaign (organization_id, status, created_at)"
  );
  console.log("OK - Tabla campaign creada o ya existia");
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
