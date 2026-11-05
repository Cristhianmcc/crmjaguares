import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { isSuperAdminUser } from "@/server/auth/admin";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getPlan, type PlanId } from "@/lib/planes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const isAdmin = await isSuperAdminUser(session.user.id, session.user.email);
    if (!isAdmin) {
      return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clientName = (body.clientName || "").trim();
    const businessName = (body.businessName || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    const planId = (body.plan || "trial") as PlanId;
    const rubro = (body.rubro || "servicios").trim();
    const durationDays = Number(body.durationDays) || (planId === "trial" ? 14 : 30);

    if (!clientName || !businessName || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos (nombre, negocio, email, contraseña) son obligatorios." },
        { status: 422 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 422 }
      );
    }

    const plan = getPlan(planId);

    // 1. Crear el usuario en Better Auth (usando runInternalSignup para bypass de checks)
    let signupResult;
    try {
      signupResult = await runInternalSignup(() =>
        auth.api.signUpEmail({
          body: {
            name: clientName,
            email,
            password,
          },
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar usuario";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const createdUserId = signupResult?.user?.id;
    if (!createdUserId) {
      return NextResponse.json(
        { error: "No se pudo obtener el ID del usuario creado." },
        { status: 500 }
      );
    }

    // 2. Localizar la organización creada para este usuario
    const db = getDb();
    const memberships = await db
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, createdUserId))
      .limit(1);

    const orgId = memberships[0]?.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No se encontró la organización asignada al nuevo usuario." },
        { status: 500 }
      );
    }

    // 3. Configurar nombre del negocio y vigencia del plan
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const isTrial = planId === "trial";

    await db
      .update(schema.organization)
      .set({
        name: businessName,
        plan: plan.id,
        rubro,
        trialEndsAt: isTrial ? expiresAt : null,
        planExpiresAt: !isTrial ? expiresAt : null,
      })
      .where(eq(schema.organization.id, orgId));

    return NextResponse.json({
      ok: true,
      orgId,
      userId: createdUserId,
      clientName,
      businessName,
      email,
      password,
      plan: plan.id,
      planNombre: plan.nombre,
      rubro,
      durationDays,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno del servidor";
    console.error("[Admin create client error]:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

