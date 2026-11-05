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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));

  if (!action || !["suspend", "reactivate", "extend"].includes(action)) {
    return NextResponse.json(
      { error: "Acción inválida. Usa 'suspend', 'reactivate' o 'extend'." },
      { status: 422 }
    );
  }

  const db = getDb();

  // Proteger la organización del Super Admin para que no pueda suspenderse por error
  const adminMembership = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, session.user.id))
    .limit(1);

  const currentOrgId = adminMembership[0]?.organizationId;
  if (action === "suspend" && id === currentOrgId) {
    return NextResponse.json(
      { error: "No puedes suspender tu propia organización principal de administrador." },
      { status: 400 }
    );
  }

  const orgRows = await db
    .select({
      id: schema.organization.id,
      plan: schema.organization.plan,
      trialEndsAt: schema.organization.trialEndsAt,
      planExpiresAt: schema.organization.planExpiresAt,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, id))
    .limit(1);

  const org = orgRows[0];
  if (!org) {
    return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  }

  let trialEndsAt = org.trialEndsAt;
  let planExpiresAt = org.planExpiresAt;
  let plan = org.plan;

  if (action === "suspend") {
    // Poner ambas fechas en el pasado (ayer) para activar el bloqueo de inmediato
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    trialEndsAt = past;
    planExpiresAt = past;
  } else if (action === "reactivate") {
    // Si era trial o cualquier plan, reactivar con 30 días
    if (plan === "trial") plan = "basico";
    planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    trialEndsAt = null;
  } else if (action === "extend") {
    // Añadir 30 días a la fecha actual o existente
    const baseTime =
      planExpiresAt && planExpiresAt.getTime() > Date.now()
        ? planExpiresAt.getTime()
        : Date.now();
    planExpiresAt = new Date(baseTime + 30 * 24 * 60 * 60 * 1000);
    if (plan === "trial") plan = "basico";
    trialEndsAt = null;
  }

  await db
    .update(schema.organization)
    .set({
      plan,
      trialEndsAt,
      planExpiresAt,
    })
    .where(eq(schema.organization.id, id));

  return NextResponse.json({
    ok: true,
    action,
    plan,
    trialEndsAt,
    planExpiresAt,
  });
}
