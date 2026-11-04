import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export { syncSuperAdmin } from "./bootstrap-admin";

/**
 * Determina si el usuario actual tiene permisos de Super-Admin
 * para gestionar todas las cuentas y organizaciones del CRM.
 */
export async function isSuperAdminUser(userId: string, email: string): Promise<boolean> {
  const envAdmin = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = email.trim().toLowerCase();

  // 1. Coincide con cualquiera de los correos en SUPER_ADMIN_EMAIL (soporta múltiples separados por coma)
  if (envAdmin) {
    const allowed = envAdmin.split(",").map((s) => s.trim());
    if (allowed.includes(userEmail)) return true;
  }

  // 2. Correos del creador / administrador de la plataforma por defecto
  if (
    userEmail === "cris@jaguares.com" ||
    userEmail === "cristhianmc303@gmail.com"
  ) {
    return true;
  }

  // 3. O es el propietario ('owner') de la organización principal / primera org creada
  try {
    const db = getDb();
    const firstOrg = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .orderBy(schema.organization.createdAt)
      .limit(1);

    if (firstOrg[0]) {
      const membership = await db
        .select({ role: schema.member.role })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.userId, userId),
            eq(schema.member.organizationId, firstOrg[0].id)
          )
        )
        .limit(1);

      if (membership[0]?.role === "owner") {
        return true;
      }
    }
  } catch (err) {
    console.error("[isSuperAdminUser] Error verificando rol:", err);
  }

  return false;
}


