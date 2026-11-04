import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/auth/session";
import { getPlan, type PlanId } from "@/lib/planes";
import { getTaypiClient } from "@/server/taypi/config";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isSuperAdminUser } from "@/server/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const planId = body.planId as PlanId;

    if (!planId || !["basico", "pro", "test"].includes(planId)) {
      return NextResponse.json(
        { error: "Plan inválido para pago. Elige 'basico', 'pro' o 'test'." },
        { status: 422 }
      );
    }

    const db = getDb();

    // El plan de prueba de S/ 1.00 es estrictamente para el Super Admin
    if (planId === "test") {
      const userRow = await db
        .select({ email: schema.user.email })
        .from(schema.user)
        .where(eq(schema.user.id, session.userId))
        .limit(1);
      const isSuper = await isSuperAdminUser(session.userId, userRow[0]?.email || "");
      if (!isSuper) {
        return NextResponse.json(
          { error: "El cobro de prueba de S/ 1.00 está reservado únicamente para el Super Administrador." },
          { status: 403 }
        );
      }
    }

    const plan = getPlan(planId);
    if (!plan || plan.precio <= 0) {
      return NextResponse.json(
        { error: "El plan seleccionado no requiere pago." },
        { status: 422 }
      );
    }

    const client = getTaypiClient();
    if (!client) {
      return NextResponse.json(
        { error: "La pasarela de pagos Taypi no está configurada en este servidor." },
        { status: 503 }
      );
    }

    const orderId = randomUUID();
    const amountStr = plan.precio.toFixed(2); // ej. "79.00" o "109.00"
    const amountCents = Math.round(plan.precio * 100);

    // 1. Registrar pedido inicial
    await db.insert(schema.paymentOrder).values({
      id: orderId,
      organizationId: session.organizationId,
      planId: plan.id,
      amount: amountCents,
      currency: "PEN",
      status: "pending",
    });

    // 2. Crear sesión de pago en Taypi
    let payment;
    try {
      payment = await client.createPayment(
        {
          amount: amountStr,
          reference: orderId,
          description: `${plan.nombre} - Monterrial CRM (S/ ${amountStr})`,
          metadata: {
            organizationId: session.organizationId,
            userId: session.userId,
            planId: plan.id,
          },
        },
        orderId // Idempotency key
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al conectar con Taypi";
      console.error("[Taypi createPayment error]:", msg);
      return NextResponse.json(
        { error: `No pudimos generar el cobro QR en Taypi: ${msg}` },
        { status: 400 }
      );
    }

    const checkoutToken = (payment.checkout_token || payment.token) as string;
    const paymentId = (payment.payment_id || payment.id) as string;

    if (!checkoutToken || !paymentId) {
      return NextResponse.json(
        { error: "Taypi no devolvió un token de pago válido." },
        { status: 400 }
      );
    }

    // 3. Actualizar registro con tokens de Taypi
    await db
      .update(schema.paymentOrder)
      .set({
        checkoutToken,
        paymentId,
      })
      .where(eq(schema.paymentOrder.id, orderId));

    return NextResponse.json({
      orderId,
      checkout_token: checkoutToken,
      paymentId,
      amount: amountStr,
      currency: "PEN",
      status: "pending",
    });
  } catch (error: unknown) {
    console.error("[checkout API error]:", error);
    return NextResponse.json(
      { error: "Error de autenticación o procesamiento del pedido." },
      { status: 401 }
    );
  }
}
