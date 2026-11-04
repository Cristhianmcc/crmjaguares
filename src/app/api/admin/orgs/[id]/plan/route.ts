import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { PlanId } from "@/lib/planes";
import { PLANES } from "@/lib/planes";

async function requireAdmin() {
  const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  if (!ADMIN_EMAIL) return null;
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.email !== ADMIN_EMAIL) return null;
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
  const { plan } = await req.json();

  if (!plan || !(plan in PLANES)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 422 });
  }

  const db = getDb();
  await db
    .update(schema.organization)
    .set({ plan: plan as PlanId })
    .where(eq(schema.organization.id, id));

  return NextResponse.json({ ok: true });
}

