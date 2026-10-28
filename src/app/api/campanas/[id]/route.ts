/**
 * GET    /api/campanas/[id] — detalle de campaña
 * PATCH  /api/campanas/[id] — actualizar borrador
 * DELETE /api/campanas/[id] — eliminar borrador
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  nombre: z.string().min(3).max(100).optional(),
  mensaje: z.string().min(10).max(4096).optional(),
  tipo: z.enum(["renovacion", "aviso"]).optional(),
});

export const GET = withAuth(async (session, _req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const db = getDb();

  const [row] = await db
    .select()
    .from(schema.campaign)
    .where(
      and(
        eq(schema.campaign.id, id),
        scoped(schema.campaign.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!row) return apiError(404, "campana_no_encontrada", "La campaña no existe");
  return Response.json({ campaign: row });
});

export const PATCH = withAuth(async (session, req: Request, ctx: unknown) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.campaign)
    .where(
      and(
        eq(schema.campaign.id, id),
        scoped(schema.campaign.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!existing) return apiError(404, "campana_no_encontrada", "La campaña no existe");
  if (existing.status !== "borrador") {
    return apiError(400, "campana_no_editable", "Solo se pueden editar campañas en borrador");
  }

  const [updated] = await db
    .update(schema.campaign)
    .set({
      ...body.data,
      updatedAt: new Date(),
    })
    .where(eq(schema.campaign.id, id))
    .returning();

  return Response.json({ campaign: updated });
});

export const DELETE = withAuth(async (session, _req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.campaign)
    .where(
      and(
        eq(schema.campaign.id, id),
        scoped(schema.campaign.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!existing) return apiError(404, "campana_no_encontrada", "La campaña no existe");
  if (existing.status === "enviando") {
    return apiError(400, "campana_en_proceso", "No se puede eliminar una campaña en curso");
  }

  await db.delete(schema.campaign).where(eq(schema.campaign.id, id));
  return Response.json({ ok: true });
});
