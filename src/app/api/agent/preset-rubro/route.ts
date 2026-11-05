import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/db/ids";
import { RUBRO_PRESETS, type RubroPresetId } from "@/lib/rubro-presets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  presetId: z.enum(["dental", "servicios", "escuela", "comercio"]),
  replaceKb: z.boolean().optional().default(false),
});

export const POST = withAuth(async (session, req: Request) => {
  if (!canConfigure(session.role)) {
    return apiError(403, "forbidden", "Solo quien administra puede cargar una plantilla");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const { presetId, replaceKb } = body.data;
  const preset = RUBRO_PRESETS[presetId as RubroPresetId];
  if (!preset) {
    return apiError(400, "bad_request", "Plantilla no válida");
  }

  const db = getDb();

  // 1. Obtener datos de la organización
  const orgRows = await db
    .select({ name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.id, session.organizationId))
    .limit(1);

  const businessName = orgRows[0]?.name || "nuestro negocio";

  // 2. Actualizar perfil de agente
  await db
    .update(schema.agentProfile)
    .set({
      name: preset.agentName,
      tone: preset.tone,
      instructions: preset.instructions,
      escalationRules: preset.escalationRules,
      greeting: preset.greeting(businessName),
      updatedAt: new Date(),
    })
    .where(scoped(schema.agentProfile.organizationId, session.organizationId));

  // 3. Manejo de base de conocimiento (KB)
  if (replaceKb) {
    await db
      .delete(schema.kbEntry)
      .where(scoped(schema.kbEntry.organizationId, session.organizationId));
  }

  const entriesToInsert = [
    ...preset.blocks.map((b) => ({
      id: newId("kbEntry"),
      organizationId: session.organizationId,
      kind: "block" as const,
      content: b.content,
      question: null,
      answer: null,
    })),
    ...preset.qa.map((q) => ({
      id: newId("kbEntry"),
      organizationId: session.organizationId,
      kind: "qa" as const,
      content: null,
      question: q.question,
      answer: q.answer,
    })),
  ];

  if (entriesToInsert.length > 0) {
    await db.insert(schema.kbEntry).values(entriesToInsert);
  }

  return Response.json({
    ok: true,
    presetId,
    presetName: preset.label,
    entriesAdded: entriesToInsert.length,
  });
});
