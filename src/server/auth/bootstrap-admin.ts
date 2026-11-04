import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { onUserCreated } from "@/server/auth/on-signup";

/**
 * Inicializa o sincroniza la cuenta del Super Admin automáticamente al arrancar.
 * Toma los datos de SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD de las variables de entorno.
 * Si no están definidas, usa valores por defecto seguros para que el dueño nunca quede bloqueado.
 */
export async function syncSuperAdmin(): Promise<void> {
  try {
    const rawEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
    const adminEmail = (rawEmail ? rawEmail.split(",")[0]?.trim() : "") || "cristhianmc303@gmail.com";
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || "Monterrial2026!";
    const adminName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

    if (!adminEmail) return;

    const db = getDb();

    // 1. Verificar si el usuario ya existe en la tabla "user"
    const existingUsers = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.email, adminEmail.toLowerCase()))
      .limit(1);

    const existingUser = existingUsers[0];

    if (!existingUser) {
      // Crear nuevo usuario Super Admin
      const userId = randomUUID();
      const hashedPassword = await hashPassword(adminPassword);

      await db.insert(schema.user).values({
        id: userId,
        name: adminName,
        email: adminEmail.toLowerCase(),
        emailVerified: true,
      });

      await db.insert(schema.account).values({
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId: userId,
        password: hashedPassword,
      });

      // Crear organización, miembro owner, pipeline y perfil de agente
      await onUserCreated(userId, adminName);

      // Asignar Plan Pro permanente a la organización creada
      const memberRow = await db
        .select({ orgId: schema.member.organizationId })
        .from(schema.member)
        .where(eq(schema.member.userId, userId))
        .limit(1);

      if (memberRow[0]) {
        await db
          .update(schema.organization)
          .set({
            name: "Monterrial Central",
            plan: "pro",
            planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10), // 10 años
          })
          .where(eq(schema.organization.id, memberRow[0].orgId));
      }

      console.log(`[boot-admin] Super Admin creado con éxito: ${adminEmail}`);
    } else {
      // El usuario ya existe: si hay contraseña especificada, sincronizarla
      if (adminPassword) {
        const hashedPassword = await hashPassword(adminPassword);
        const existingAccounts = await db
          .select({ id: schema.account.id })
          .from(schema.account)
          .where(eq(schema.account.userId, existingUser.id))
          .limit(1);

        if (existingAccounts[0]) {
          await db
            .update(schema.account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(eq(schema.account.id, existingAccounts[0].id));
        } else {
          await db.insert(schema.account).values({
            id: randomUUID(),
            accountId: existingUser.id,
            providerId: "credential",
            userId: existingUser.id,
            password: hashedPassword,
          });
        }
      }

      // Asegurar que su membresía sea 'owner' y su organización esté en 'pro'
      const memberRows = await db
        .select({ id: schema.member.id, orgId: schema.member.organizationId })
        .from(schema.member)
        .where(eq(schema.member.userId, existingUser.id))
        .limit(1);

      if (memberRows[0]) {
        await db
          .update(schema.member)
          .set({ role: "owner" })
          .where(eq(schema.member.id, memberRows[0].id));

        await db
          .update(schema.organization)
          .set({ plan: "pro" })
          .where(eq(schema.organization.id, memberRows[0].orgId));
      }

      console.log(`[boot-admin] Super Admin verificado y sincronizado: ${adminEmail}`);
    }
  } catch (err) {
    console.error("[boot-admin] Error al inicializar Super Admin:", err);
  }
}
