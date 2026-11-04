import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getTaypiClient } from "@/server/taypi/config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.paymentOrder)
    .where(eq(schema.paymentOrder.id, id))
    .limit(1);

  const order = rows[0];
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  // Si está pendiente y tiene paymentId, reconciliar con Taypi
  if (order.status === "pending" && order.paymentId) {
    try {
      const client = getTaypiClient();
      if (client) {
        const remote = await client.getPayment(order.paymentId);
        if (remote && remote.status === "completed") {
          const paidAt = remote.paid_at ? new Date(remote.paid_at as string) : new Date();
          const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          await db
            .update(schema.paymentOrder)
            .set({ status: "completed", paidAt })
            .where(eq(schema.paymentOrder.id, id));

          await db
            .update(schema.organization)
            .set({
              plan: order.planId,
              planExpiresAt,
            })
            .where(eq(schema.organization.id, order.organizationId));

          return NextResponse.json({
            orderId: order.id,
            status: "completed",
            planId: order.planId,
            amount: (order.amount / 100).toFixed(2),
            paidAt,
          });
        }
      }
    } catch (e) {
      console.error("[Reconcile Taypi error]:", e);
    }
  }

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    planId: order.planId,
    amount: (order.amount / 100).toFixed(2),
    paidAt: order.paidAt,
  });
}
