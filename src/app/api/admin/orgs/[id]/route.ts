import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { isSuperAdminUser } from "@/server/auth/admin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const isAdmin = await isSuperAdminUser(session.user.id, session.user.email);
  if (!isAdmin) return null;
  return session;
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // 1. Proteger la organización del Super Admin
  const adminMembership = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .limit(1);

  const currentOrgId = adminMembership[0]?.organizationId;
  if (id === currentOrgId) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia organización principal de administrador." },
      { status: 400 }
    );
  }

  // 2. Proteger la organización raíz original (más antigua)
  const rootOrgs = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .orderBy(schema.organization.createdAt)
    .limit(1);

  if (rootOrgs[0]?.id === id) {
    return NextResponse.json(
      { error: "No puedes eliminar la organización raíz original del sistema." },
      { status: 400 }
    );
  }

  // 3. Verificar que la organización existe
  const orgRows = await db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.id, id))
    .limit(1);

  const org = orgRows[0];
  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  // 4. Obtener todos los miembros de la organización a eliminar
  const orgMembers = await db
    .select({ userId: schema.member.userId })
    .from(schema.member)
    .where(eq(schema.member.organizationId, id));

  // 5. Eliminar la organización (Postgres cascadea automáticamente a todas las tablas con onDelete: cascade)
  await db.delete(schema.organization).where(eq(schema.organization.id, id));

  // 6. Limpiar usuarios huérfanos que pertenecían únicamente a este negocio eliminado
  for (const m of orgMembers) {
    if (m.userId === session.user.id) continue;
    const remaining = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.userId, m.userId))
      .limit(1);

    if (remaining.length === 0) {
      await db.delete(schema.session).where(eq(schema.session.userId, m.userId));
      await db.delete(schema.account).where(eq(schema.account.userId, m.userId));
      await db.delete(schema.user).where(eq(schema.user.id, m.userId));
    }
  }

  return NextResponse.json({ ok: true, deletedId: id, name: org.name });
}
