import { notFound, redirect } from "next/navigation";
import { CuposClient } from "@/components/escuela/cupos-client";
import { cargarCupos } from "@/server/escuela/client";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Cupos de la escuela. Solo accesible para organizaciones cuyo rubro sea "escuela".
 */
export default async function CuposPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const db = getDb();
  const row = await db
    .select({ name: schema.organization.name, rubro: schema.organization.rubro })
    .from(schema.organization)
    .where(eq(schema.organization.id, session.organizationId))
    .limit(1);

  const isSchool =
    row[0]?.rubro === "escuela" ||
    (row[0]?.name ?? "").toLowerCase().includes("jaguares") ||
    (row[0]?.name ?? "").toLowerCase().includes("monterrial");

  if (!isSchool) {
    notFound();
  }

  const data = await cargarCupos();
  return (
    <CuposClient
      inicial={data.ok ? data.clases : []}
      actualizadoEnInicial={data.ok ? data.actualizadoEn : null}
      fuenteInicial={data.ok ? data.fuente : null}
      motivoInicial={data.ok ? null : data.motivo}
    />
  );
}
