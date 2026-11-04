import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTaypiConfig, getTaypiClient } from "@/server/taypi/config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const config = getTaypiConfig();
  const rawBody = await req.text();
  const signature =
    req.headers.get("taypi-signature") ||
    req.headers.get("x-taypi-signature") ||
    "";

  // Verificar firma webhook si hay secret configurado
  if (config.webhookSecret) {
    const client = getTaypiClient();
    const isValid = client
      ? client.verifyWebhook(rawBody, signature, config.webhookSecret)
      : false;

    if (!isValid) {
      console.warn("[Taypi Webhook] Firma inválida rechazada:", signature);
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  let event: {
    event?: string;
    reference?: string;
    payment_id?: string;
    amount?: string | number;
    currency?: string;
    status?: string;
    paid_at?: string;
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { event: eventName, reference: orderId, status } = event;

  if (!orderId || !eventName) {
    return NextResponse.json({ received: true, ignored: true });
  }

  console.log(`[Taypi Webhook] Evento recibido: ${eventName} para pedido ${orderId}`);

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.paymentOrder)
    .where(eq(schema.paymentOrder.id, orderId))
    .limit(1);

  const order = rows[0];
  if (!order) {
    console.warn(`[Taypi Webhook] Pedido ${orderId} no encontrado en la base de datos.`);
    return NextResponse.json({ received: true, not_found: true });
  }

  if (eventName === "payment.completed" || status === "completed") {
    const paidAt = event.paid_at ? new Date(event.paid_at) : new Date();
    // 30 días de suscripción
    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 1. Actualizar orden a completada
    await db
      .update(schema.paymentOrder)
      .set({
        status: "completed",
        paidAt,
        paymentId: event.payment_id || order.paymentId,
      })
      .where(eq(schema.paymentOrder.id, order.id));

    // 2. Activar plan y extender expiración en la organización
    await db
      .update(schema.organization)
      .set({
        plan: order.planId,
        planExpiresAt,
      })
      .where(eq(schema.organization.id, order.organizationId));

    console.log(
      `[Taypi Webhook] ✅ Plan '${order.planId}' activado exitosamente para org '${order.organizationId}' hasta ${planExpiresAt.toISOString()}`
    );
  } else if (eventName === "payment.failed" || eventName === "payment.expired") {
    await db
      .update(schema.paymentOrder)
      .set({
        status: eventName === "payment.expired" ? "expired" : "failed",
      })
      .where(eq(schema.paymentOrder.id, order.id));
  }

  return NextResponse.json({ received: true });
}
