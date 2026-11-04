import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getPlan, type PlanId } from "@/lib/planes";
import { getRemainingTrialDays, isPlanActive } from "@/lib/plan-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const db = getDb();

    const orgs = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, session.organizationId))
      .limit(1);

    const org = orgs[0];
    if (!org) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }

    const planId = (org.plan || "trial") as PlanId;
    const plan = getPlan(planId);

    const diasRestantes = getRemainingTrialDays({
      plan: planId,
      trialEndsAt: org.trialEndsAt,
      planExpiresAt: org.planExpiresAt,
    });

    const activo = isPlanActive({
      plan: planId,
      trialEndsAt: org.trialEndsAt,
      planExpiresAt: org.planExpiresAt,
    });

    return NextResponse.json({
      organizationId: org.id,
      name: org.name,
      plan: planId,
      planNombre: plan.nombre,
      planPrecio: plan.precio,
      activo,
      diasRestantes,
      trialEndsAt: org.trialEndsAt,
      planExpiresAt: org.planExpiresAt,
    });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
