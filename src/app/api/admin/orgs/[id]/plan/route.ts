import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { isSuperAdminUser } from "@/server/auth/admin";
import type { PlanId } from "@/lib/planes";
import { PLANES } from "@/lib/planes";

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
  const { plan, durationDays } = await req.json().catch(() => ({}));

  if (!plan || !(plan in PLANES)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 422 });
  }

  const isTrial = plan === "trial";
  const days = Number(durationDays) || (isTrial ? 14 : 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const db = getDb();
  await db
    .update(schema.organization)
    .set({
      plan: plan as PlanId,
      trialEndsAt: isTrial ? expiresAt : null,
      planExpiresAt: !isTrial ? expiresAt : null,
    })
    .where(eq(schema.organization.id, id));

  return NextResponse.json({ ok: true, plan, expiresAt: expiresAt.toISOString() });
}
