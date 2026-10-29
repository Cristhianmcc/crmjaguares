import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { estadoIaDe, mensajeDeEstado } from "@/lib/ai/provider";
import {
  CLAVES_HERRAMIENTA,
  herramientasEfectivas,
  rolDe,
  type ClaveHerramienta,
} from "@/lib/agent-roles";
import { agendaEnabled } from "@/server/agenda/flag";
import { leerConfigDespacho, urlSaludCerebro } from "@/server/brains/config";
import { isAiConfiguredFor } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.agentProfile)
    .where(scoped(schema.agentProfile.organizationId, session.organizationId))
    .limit(1);
  const p = rows[0];
  if (!p) return apiError(404, "not_found", "Perfil del agente no encontrado");
  const estado = await estadoIaDe(session.organizationId);
  return Response.json({
    profile: {
      enabled: p.enabled,
      name: p.name,
      tone: p.tone,
      instructions: p.instructions,
      escalationRules: p.escalationRules,
      greeting: p.greeting,
      // 034
      role: rolDe(p.role).clave,
      tools: herramientasEfectivas(p.tools),
    },
    // 034 — Sin la bandera, la pantalla no ofrece agendar ni reprogramar.
    agendaEnabled: agendaEnabled(),
    aiConfigured: estado.activa,
    // Por qué no (sin configurar, llave rechazada, sin saldo): la pantalla
    // Agente lo dice con el enlace a Ajustes → IA.
    aiMensaje: mensajeDeEstado(estado),
  });
});

const putSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  tone: z.string().max(500).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  escalationRules: z.string().max(4000).nullable().optional(),
  greeting: z.string().max(1000).nullable().optional(),
  // 034 — Solo claves del catálogo; `escalar` se guarda siempre.
  tools: z
    .array(z.enum(CLAVES_HERRAMIENTA as [ClaveHerramienta, ...ClaveHerramienta[]]))
    .max(CLAVES_HERRAMIENTA.length)
    .optional(),
});

export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  // 036 — El interruptor decide si el agente responde. Encenderlo
  // sin IA o sin cerebro que conteste dejaría a los clientes sin respuesta.
  if (body.data.enabled === true) {
    const problema = await problemaDelCerebro(session.organizationId);
    if (problema) return apiError(409, "sin_cerebro", problema);
  }

  const db = getDb();
  const { tools, ...resto } = body.data;
  const updated = await db
    .update(schema.agentProfile)
    .set({
      ...resto,
      ...(tools ? { tools: herramientasEfectivas(tools) } : {}),
      updatedAt: new Date(),
    })
    .where(scoped(schema.agentProfile.organizationId, session.organizationId))
    .returning();
  if (!updated[0]) return apiError(404, "not_found", "Perfil no encontrado");
  return Response.json({ ok: true });
});

/** Por qué no se puede encender el agente, o `null` si hay cerebro sano. */
async function problemaDelCerebro(organizationId: string): Promise<string | null> {
  const despacho = leerConfigDespacho();
  if (despacho.active) {
    const { getBrainHealth } = await import("@/server/bot/status");
    const salud = await getBrainHealth(urlSaludCerebro() ?? undefined);
    if (salud && !salud.reachable) {
      return `Tu agente (${despacho.host}) no contesta. Revisa que esté corriendo y vuelve a intentar.`;
    }
    return null;
  }
  // Si no hay despacho externo, el CRM usa el agente integrado: requiere IA configurada
  const aiOk = await isAiConfiguredFor(organizationId);
  if (!aiOk) {
    return "No hay proveedor de IA configurado. Conéctalo en Ajustes → IA antes de encender el agente.";
  }
  return null;
}
