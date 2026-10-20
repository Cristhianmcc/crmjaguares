import { and, asc, desc, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { publish } from "@/server/events/bus";
import { runAgentTurn } from "@/server/ai/pipeline";
import { renderKb } from "@/server/ai/prompts";
import { leerConfigDespacho } from "@/server/brains/config";
import { construirEventoOlvido } from "@/server/brains/contract";
import { avisarOlvido } from "@/server/brains/deliver";
import { encolarDespacho } from "@/server/dispatch/outbox";
import { iniciarWorker, programarTanda } from "@/server/dispatch/worker";
import { computeScore, judgeCase } from "@/server/lab/judge";
import { PERSONAS, type Persona } from "@/server/lab/personas";

/**
 * Runner del Laboratorio (FR-030/FR-034): corrida en segundo plano DENTRO del
 * proceso (sin cola externa), turnos secuenciales con debounce 0, timeout
 * global de 10 minutos, y lock de concurrencia por índice parcial UNIQUE en
 * BD (máx. 1 corrida `running` por organización).
 *
 * Sandbox (FR-031): las conversaciones se crean con is_test=true; el pipeline
 * del agente persiste las respuestas sin tocar la API, y el sender real lanza
 * si algo intenta enviarlas.
 *
 * 033 — Con el despacho activo, el Laboratorio prueba al cerebro que de
 * verdad contesta: cada línea entra como un mensaje del cliente, se le
 * despacha sin ventana de agrupado, y su respuesta vuelve por
 * `/api/bot/messages`, que la guarda sin enviarla. Sin despacho, contra el
 * agente incluido, como siempre.
 */

const RUN_TIMEOUT_MS = 10 * 60 * 1000;

/** 033 — Cuánto se le espera al cerebro en cada línea del guion. */
export const TURNO_TIMEOUT_MS = 90_000;
const SONDEO_MS = 500;
/** Tras la primera respuesta, lo que se espera por más mensajes o un traspaso. */
const QUIETUD_MS = 1_500;

export class RunConflictError extends Error {}

export async function startRun(organizationId: string): Promise<string> {
  const db = getDb();
  let runId: string;
  try {
    const inserted = await db
      .insert(schema.agentTestRun)
      .values({ id: newId("testRun"), organizationId, status: "running" })
      .returning();
    runId = inserted[0]!.id;
  } catch (err) {
    // Violación del índice parcial UNIQUE → ya hay una corrida activa.
    if (isUniqueViolation(err)) {
      throw new RunConflictError("Ya hay una corrida en curso");
    }
    throw err;
  }

  await db.insert(schema.agentTestCase).values(
    PERSONAS.map((p) => ({
      id: newId("testCase"),
      organizationId,
      runId,
      persona: p.key,
      status: "pending" as const,
    }))
  );

  // Fire-and-forget in-process: el POST regresa ya; el progreso va por SSE.
  void executeRun(runId, organizationId).catch(async (err) => {
    console.error("[lab] corrida falló:", err);
    await failRun(runId, organizationId, String(err));
  });

  return runId;
}

async function executeRun(
  runId: string,
  organizationId: string
): Promise<void> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("timeout de 10 minutos superado")),
      RUN_TIMEOUT_MS
    )
  );
  try {
    await Promise.race([runAllCases(runId, organizationId), timeout]);
  } catch (err) {
    await failRun(runId, organizationId, String(err));
  }
}

async function runAllCases(
  runId: string,
  organizationId: string
): Promise<void> {
  const db = getDb();
  const cases = await db
    .select()
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId))
    .orderBy(asc(schema.agentTestCase.createdAt));

  const kbEntries = await db
    .select()
    .from(schema.kbEntry)
    .where(eq(schema.kbEntry.organizationId, organizationId));
  const kbText = renderKb(kbEntries);

  const profileRows = await db
    .select()
    .from(schema.agentProfile)
    .where(eq(schema.agentProfile.organizationId, organizationId))
    .limit(1);
  const profile = profileRows[0];
  const behaviorText = profile
    ? [
        `Nombre: ${profile.name}`,
        profile.tone ? `Tono: ${profile.tone}` : null,
        profile.instructions ? `Instrucciones: ${profile.instructions}` : null,
        profile.escalationRules ? `Escalado: ${profile.escalationRules}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  let done = 0;
  const total = cases.length;
  publishProgress(organizationId, runId, "running", done, total);
  // 033 — Quién contesta en producción es quien se prueba.
  const porDespacho = leerConfigDespacho().active;
  const fallas: string[] = [];

  for (const testCase of cases) {
    const persona = PERSONAS.find((p) => p.key === testCase.persona);
    if (!persona) continue;

    await db
      .update(schema.agentTestCase)
      .set({ status: "running" })
      .where(eq(schema.agentTestCase.id, testCase.id));

    const { transcript, conversationId, falla } = await runConversation(
      organizationId,
      persona,
      porDespacho
    );

    if (falla) {
      // 033 — El agente no contestó: no hay nada que juzgar, y el motivo es
      // lo que el dueño necesita ver (sale en el error de la corrida).
      fallas.push(`${persona.label}: ${falla}`);
      await db
        .update(schema.agentTestCase)
        .set({ conversationId, transcript, status: "agent_failed" })
        .where(eq(schema.agentTestCase.id, testCase.id));
      done += 1;
      publishProgress(organizationId, runId, "running", done, total);
      continue;
    }

    const outcome = await judgeCase({
      organizationId,
      personaKey: persona.key,
      transcript,
      kbText,
      behaviorText,
    });

    await db
      .update(schema.agentTestCase)
      .set({
        conversationId,
        transcript,
        status: outcome.status,
        veredicto: outcome.status === "done" ? outcome.verdict.veredicto : null,
        hallazgos: outcome.status === "done" ? outcome.verdict.hallazgos : null,
      })
      .where(eq(schema.agentTestCase.id, testCase.id));

    done += 1;
    publishProgress(organizationId, runId, "running", done, total);
  }

  const finalCases = await db
    .select({
      status: schema.agentTestCase.status,
      veredicto: schema.agentTestCase.veredicto,
    })
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId));
  const score = computeScore(finalCases);

  if (fallas.length === total) {
    // Nadie contestó: no es un score de cero, es que no había a quién probar.
    await failRun(runId, organizationId, `el agente no contestó: ${fallas[0]}`);
    return;
  }

  await getDb()
    .update(schema.agentTestRun)
    .set({
      status: "done",
      score,
      error: fallas.length ? fallas.join(" · ") : null,
      finishedAt: new Date(),
    })
    .where(eq(schema.agentTestRun.id, runId));
  publishProgress(organizationId, runId, "done", done, total, score);
}

/** Conversa el guion completo contra el agente real; corta al primer handoff. */
async function runConversation(
  organizationId: string,
  persona: Persona,
  porDespacho: boolean
): Promise<{
  transcript: { role: "cliente" | "agente"; text: string }[];
  conversationId: string;
  /** 033 — Por qué el agente no contestó, si no contestó. */
  falla: string | null;
}> {
  const db = getDb();

  // Contacto sintético ARCHIVADO (no aparece en la lista ni genera leads).
  const contactId = await upsertTestContact(organizationId, persona);

  const convId = newId("conversation");
  await db.insert(schema.conversation).values({
    id: convId,
    organizationId,
    contactId,
    isTest: true,
    aiEnabled: true,
  });

  let falla: string | null = null;
  for (const line of persona.script) {
    const now = new Date();
    const messageId = newId("message");
    await db.insert(schema.message).values({
      id: messageId,
      organizationId,
      conversationId: convId,
      direction: "in",
      type: "text",
      text: line,
      status: "delivered",
      waTimestamp: now,
    });
    await db
      .update(schema.conversation)
      .set({ lastInboundAt: now, lastMessageAt: now, updatedAt: now })
      .where(eq(schema.conversation.id, convId));

    // Turno REAL del agente, secuencial y sin debounce (FR-030). 033 — Por
    // despacho cuando es el cerebro externo quien contesta en producción.
    if (porDespacho) {
      falla = await turnoPorDespacho(organizationId, convId, messageId, now);
      if (falla) break;
    } else {
      await runAgentTurn(convId);
    }

    const convRows = await db
      .select({ handoffAt: schema.conversation.handoffAt })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, convId))
      .limit(1);
    if (convRows[0]?.handoffAt) break; // primer handoff → fin del guion
  }

  const messages = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, convId))
    .orderBy(asc(schema.message.createdAt));

  if (porDespacho) await olvidar(organizationId, convId, contactId);

  return {
    conversationId: convId,
    falla,
    transcript: messages
      .filter((m) => m.text)
      .map((m) => ({
        role: m.direction === "in" ? ("cliente" as const) : ("agente" as const),
        text: m.text!,
      })),
  };
}

/**
 * 033 — Un turno contra el cerebro externo: se le despacha la línea y se
 * espera, con tope, lo primero que pase.
 *
 * Devuelve null si contestó (o traspasó: también es una respuesta), o el
 * motivo si no: no llegó nada a tiempo, o el despacho cayó a humano porque el
 * cerebro no lo aceptó.
 */
async function turnoPorDespacho(
  organizationId: string,
  conversationId: string,
  messageId: string,
  desde: Date
): Promise<string | null> {
  const db = getDb();
  const { notBefore } = await encolarDespacho({
    organizationId,
    conversationId,
    messageIds: [messageId],
    inmediato: true,
  });
  iniciarWorker();
  programarTanda(notBefore);

  const limite = Date.now() + TURNO_TIMEOUT_MS;
  while (Date.now() < limite) {
    await dormir(SONDEO_MS);
    const [conv] = await db
      .select({ handoffAt: schema.conversation.handoffAt })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, conversationId))
      .limit(1);
    const [respuesta] = await db
      .select({ id: schema.message.id })
      .from(schema.message)
      .where(
        and(
          eq(schema.message.conversationId, conversationId),
          eq(schema.message.direction, "out"),
          gt(schema.message.createdAt, desde)
        )
      )
      .limit(1);
    if (respuesta) {
      // Un turno puede mandar más de un mensaje, o despedirse y traspasar:
      // se le da un momento antes de la siguiente línea.
      await dormir(QUIETUD_MS);
      return null;
    }
    const [despacho] = await db
      .select({
        status: schema.dispatch.status,
        lastError: schema.dispatch.lastError,
      })
      .from(schema.dispatch)
      .where(eq(schema.dispatch.conversationId, conversationId))
      .orderBy(desc(schema.dispatch.createdAt))
      .limit(1);
    if (despacho?.status === "caducado_a_humano") {
      return `el cerebro no aceptó el despacho (${despacho.lastError ?? "sin detalle"})`;
    }
    if (conv?.handoffAt) return null; // traspasó sin despedirse: es su respuesta
  }
  return `el cerebro no contestó en ${TURNO_TIMEOUT_MS / 1000} s`;
}

/** 033 — Que el cerebro olvide la conversación de prueba al terminar el caso. */
async function olvidar(
  organizationId: string,
  conversationId: string,
  contactId: string
): Promise<void> {
  try {
    const db = getDb();
    const [org] = await db
      .select({ id: schema.organization.id, slug: schema.organization.slug })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);
    const [contacto] = await db
      .select({ waIdentity: schema.contact.waIdentity })
      .from(schema.contact)
      .where(eq(schema.contact.id, contactId))
      .limit(1);
    if (!org || !contacto) return;
    await avisarOlvido(
      construirEventoOlvido({
        eventId: newId("olvido"),
        organization: org,
        conversation: { id: conversationId, channel: "whatsapp" },
        contact: { id: contactId, identity: contacto.waIdentity },
        deletedAt: new Date(),
      })
    );
  } catch (err) {
    // Best-effort: la regla del `conversation.id` nuevo cubre un aviso perdido.
    console.error("[lab] no se pudo avisar el olvido:", err);
  }
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upsertTestContact(
  organizationId: string,
  persona: Persona
): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(schema.contact)
    .values({
      id: newId("contact"),
      organizationId,
      phone: persona.phone,
      waIdentity: persona.phone,
      name: persona.contactName,
      archivedAt: new Date(),
    })
    // Ídem que en el alta manual: desde 014 el índice único incluye `channel`,
    // y un ON CONFLICT que no lo nombra no corresponde a ningún índice. Sin
    // esto, TODA corrida del Laboratorio muere antes de la primera persona.
    .onConflictDoNothing({
      target: [
        schema.contact.organizationId,
        schema.contact.channel,
        schema.contact.waIdentity,
      ],
    })
    .returning();
  if (inserted[0]) return inserted[0].id;
  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, organizationId),
        eq(schema.contact.phone, persona.phone)
      )
    )
    .limit(1);
  return rows[0]!.id;
}

async function failRun(
  runId: string,
  organizationId: string,
  error: string
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.agentTestRun)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(eq(schema.agentTestRun.id, runId));
  publishProgress(organizationId, runId, "failed", 0, PERSONAS.length);
}

function publishProgress(
  organizationId: string,
  runId: string,
  status: string,
  done: number,
  total: number,
  score?: number | null
): void {
  publish(organizationId, {
    type: "lab.run",
    data: { runId, status, progress: { done, total }, score },
  });
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}
