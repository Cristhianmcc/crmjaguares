import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Determina si el usuario actual tiene permisos de Super-Admin
 * para gestionar todas las cuentas y organizaciones del CRM.
 */
export async function isSuperAdminUser(userId: string, email: string): Promise<boolean> {
  const envAdmin = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const userEmail = email.trim().toLowerCase();

  // 1. Coincide con SUPER_ADMIN_EMAIL configurado en entorno
  if (envAdmin && userEmail === envAdmin) return true;

  // 2. Correos del creador / administrador de la plataforma
  if (
    userEmail === "cris@jaguares.com" ||
    userEmail === "cristhianmc303@gmail.com"
  ) {
    return true;
  }

  // 3. O es el propietario de la organización principal / primera org
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
      .where(eq(schema.member.userId, userId))
      .limit(1);

    if (membership[0]?.role === "owner") {
      return true;
    }
  }

  return false;
}
