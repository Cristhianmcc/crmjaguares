import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { onUserCreated } from "@/server/auth/on-signup";

/**
 * Inicializa o sincroniza la cuenta del Super Admin automáticamente al arrancar.
 * Si ya existe una organización previa (con Zernio, WhatsApp, DeepSeek, etc.),
 * vincula al Super Admin como 'owner' de esa organización para NO perder configuraciones.
 */
export async function syncSuperAdmin(): Promise<void> {
  try {
    const rawEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
    const adminEmail = (rawEmail ? rawEmail.split(",")[0]?.trim() : "") || "cristhianmc303@gmail.com";
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD?.trim() || "Monterrial2026!";
    const adminName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

    if (!adminEmail) return;

    const db = getDb();

    // 1. Obtener la organización principal (la primera creada, donde viven las credenciales)
    const firstOrgs = await db
      .select({ id: schema.organization.id, name: schema.organization.name })
      .from(schema.organization)
      .orderBy(schema.organization.createdAt)
      .limit(1);

    const primaryOrg = firstOrgs[0];

    // 2. Verificar si el usuario ya existe
    const existingUsers = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.email, adminEmail.toLowerCase()))
      .limit(1);

    let userId: string;

    if (!existingUsers[0]) {
      // Crear nuevo usuario Super Admin
      userId = randomUUID();
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

      console.log(`[boot-admin] Usuario Super Admin creado: ${adminEmail}`);
    } else {
      userId = existingUsers[0].id;
      // Sincronizar contraseña
      if (adminPassword) {
        const hashedPassword = await hashPassword(adminPassword);
        const existingAccounts = await db
          .select({ id: schema.account.id })
          .from(schema.account)
          .where(eq(schema.account.userId, userId))
          .limit(1);

        if (existingAccounts[0]) {
          await db
            .update(schema.account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(eq(schema.account.id, existingAccounts[0].id));
        } else {
          await db.insert(schema.account).values({
            id: randomUUID(),
            accountId: userId,
            providerId: "credential",
            userId: userId,
            password: hashedPassword,
          });
        }
      }
    }

    // 3. Vincular a la organización principal para heredar WhatsApp, DeepSeek, etc.
    if (primaryOrg) {
      // Verificar si ya tiene membresía en la org principal
      const existingMembership = await db
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(
          and(
            eq(schema.member.userId, userId),
            eq(schema.member.organizationId, primaryOrg.id)
          )
        )
        .limit(1);

      if (!existingMembership[0]) {
        // Crear o reasignar membresía hacia la org principal
        const anyMembership = await db
          .select({ id: schema.member.id })
          .from(schema.member)
          .where(eq(schema.member.userId, userId))
          .limit(1);

        if (anyMembership[0]) {
          await db
            .update(schema.member)
            .set({ organizationId: primaryOrg.id, role: "owner" })
            .where(eq(schema.member.id, anyMembership[0].id));
        } else {
          await db.insert(schema.member).values({
            id: randomUUID(),
            organizationId: primaryOrg.id,
            userId,
            role: "owner",
          });
        }
      } else {
        await db
          .update(schema.member)
          .set({ role: "owner" })
          .where(eq(schema.member.id, existingMembership[0].id));
      }

      // Asegurar plan Pro ilimitado en la organización principal
      await db
        .update(schema.organization)
        .set({
          plan: "pro",
          planExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10), // 10 años
        })
        .where(eq(schema.organization.id, primaryOrg.id));

      console.log(`[boot-admin] Super Admin ${adminEmail} vinculado a org principal '${primaryOrg.name}'`);
    } else {
      // Si no existía ninguna org, crear una nueva completa
      await onUserCreated(userId, adminName);
    }
  } catch (err) {
    console.error("[boot-admin] Error en syncSuperAdmin:", err);
  }
}
