/**
 * GET  /api/campanas   — lista campañas de la organización
 * POST /api/campanas   — crear una nueva campaña (borrador)
 */

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  tipo: z.enum(["renovacion", "aviso"]),
  nombre: z.string().min(3).max(100),
  mensaje: z.string().min(10).max(4096),
});

export const GET = withAuth(async (session) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.campaign)
    .where(scoped(schema.campaign.organizationId, session.organizationId))
    .orderBy(desc(schema.campaign.createdAt))
    .limit(50);

  return Response.json({ campaigns: rows });
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const [camp] = await db
    .insert(schema.campaign)
    .values({
      id: newId("campaign"),
      organizationId: session.organizationId,
      tipo: body.data.tipo,
      nombre: body.data.nombre,
      mensaje: body.data.mensaje,
      status: "borrador",
      createdByUserId: session.userId,
    })
    .returning();

  return Response.json({ campaign: camp }, { status: 201 });
});
