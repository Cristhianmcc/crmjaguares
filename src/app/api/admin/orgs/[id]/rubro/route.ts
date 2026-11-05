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
  const { rubro } = await req.json().catch(() => ({}));

  if (!rubro || !["servicios", "escuela", "comercio"].includes(rubro)) {
    return NextResponse.json(
      { error: "Rubro inválido. Debe ser 'servicios', 'escuela' o 'comercio'." },
      { status: 422 }
    );
  }

  const db = getDb();
  await db
    .update(schema.organization)
    .set({ rubro })
    .where(eq(schema.organization.id, id));

  return NextResponse.json({ ok: true, rubro });
}

