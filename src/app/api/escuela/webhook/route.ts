/**
 * POST /api/escuela/webhook
 *
 * Webhook que llama la WEB de Jaguares (jaguarescar.com) cuando un papá
 * completa la inscripción en línea. El CRM mueve automáticamente el lead
 * del pipeline a "Inscrito en Web".
 *
 * Seguridad: JAGUARES_WEBHOOK_SECRET en .env; el sitio lo manda en el header
 * `x-jaguares-secret`. Sin él → 401.
 *
 * Payload esperado:
 * {
 *   "phone": "987654321",           // teléfono del papá (Perú o internacional)
 *   "nombre": "Carlos López",        // nombre del papá o titular
 *   "alumno": "Mateo López",         // nombre del alumno
 *   "categoria": "Sub-10 Fútbol",    // grupo en que se inscribió
 *   "secret": "token-opcional"       // alternativa al header
 * }
 */

import { and, eq, inArray, like, or } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { moveLeadToStage } from "@/server/leads/stage-history";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  phone: z.string().min(6),
  nombre: z.string().optional(),
  alumno: z.string().optional(),
  categoria: z.string().optional(),
  secret: z.string().optional(),
});

export async function POST(req: Request): Promise<Response> {
  // --- Autenticación ---
  const envSecret = process.env.JAGUARES_WEBHOOK_SECRET ?? "";
  const headerSecret = req.headers.get("x-jaguares-secret") ?? "";

  let body: z.infer<typeof payloadSchema>;
  try {
    const raw = await req.json();
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: "payload_invalido", issues: parsed.error.issues }, { status: 422 });
    }
    body = parsed.data;
  } catch {
    return Response.json({ error: "json_invalido" }, { status: 422 });
  }

  // Acepta el secret en header O en body
  const receivedSecret = headerSecret || body.secret || "";
  if (!envSecret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[webhook-jaguares] JAGUARES_WEBHOOK_SECRET no configurado en producción");
      return Response.json({ error: "no_configurado" }, { status: 503 });
    }
  } else if (receivedSecret !== envSecret) {
    console.warn("[webhook-jaguares] secret inválido");
    return Response.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();

  // Limpieza y variantes del teléfono para coincidir sin importar el prefijo
  const rawDigits = body.phone.replace(/\D/g, "");
  const candidates = new Set<string>([body.phone, rawDigits]);

  // Si tiene prefijo de Perú (51)
  if (rawDigits.startsWith("51") && rawDigits.length >= 11) {
    candidates.add(rawDigits.slice(2)); // solo el número local
    candidates.add(rawDigits);
  } else if (rawDigits.length === 9) {
    candidates.add(`51${rawDigits}`); // agregar código Perú
    candidates.add(rawDigits);
  }

  // Si tiene prefijo de México 521 -> 52
  if (rawDigits.startsWith("521")) {
    candidates.add(rawDigits.replace(/^521/, "52"));
  }

  const candidateArray = Array.from(candidates);

  // Buscar contacto por cualquiera de las variantes o los últimos 9 dígitos
  const last9 = rawDigits.slice(-9);
  const contactRows = await db
    .select({
      id: schema.contact.id,
      organizationId: schema.contact.organizationId,
      name: schema.contact.name,
    })
    .from(schema.contact)
    .where(
      or(
        inArray(schema.contact.waIdentity, candidateArray),
        inArray(schema.contact.phone, candidateArray),
        last9.length === 9 ? like(schema.contact.waIdentity, `%${last9}%`) : undefined
      )
    )
    .limit(1);

  let contacto = contactRows[0];

  // Si el contacto aún no existe en el CRM (se inscribió directo en la web sin chatear antes)
  if (!contacto) {
    // Tomamos la primera organización existente (Jaguares)
    const [firstOrg] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .limit(1);

    if (!firstOrg) {
      return Response.json({ ok: false, error: "no_organization" }, { status: 500 });
    }

    const contactId = newId("contact");
    const [newContact] = await db
      .insert(schema.contact)
      .values({
        id: contactId,
        organizationId: firstOrg.id,
        waIdentity: rawDigits.length === 9 ? `51${rawDigits}` : rawDigits,
        phone: rawDigits,
        name: body.nombre?.trim() || `Papá/Mamá (${body.alumno || rawDigits})`,
        nameSource: "manual",
      })
      .returning();

    if (!newContact) {
      return Response.json({ ok: false, error: "contact_creation_failed" }, { status: 500 });
    }
    contacto = newContact;
  }

  // Buscar las etapas de la organización
  const stageRows = await db
    .select({
      id: schema.pipelineStage.id,
      name: schema.pipelineStage.name,
      kind: schema.pipelineStage.kind,
    })
    .from(schema.pipelineStage)
    .where(eq(schema.pipelineStage.organizationId, contacto.organizationId))
    .orderBy(schema.pipelineStage.position);

  // Buscar la etapa "Inscrito en Web" o cualquier etapa ganada (won)
  const etapaInscrito =
    stageRows.find((s) => {
      const n = s.name.toLowerCase();
      return n.includes("inscrito") || n.includes("web") || n.includes("matriculad");
    }) ?? stageRows.find((s) => s.kind === "won") ?? stageRows[stageRows.length - 1];

  if (!etapaInscrito) {
    return Response.json({ ok: false, error: "etapa_no_encontrada" }, { status: 500 });
  }

  // Buscar el lead del contacto
  const leadRows = await db
    .select({ id: schema.lead.id, stageId: schema.lead.stageId })
    .from(schema.lead)
    .where(eq(schema.lead.contactId, contacto.id))
    .limit(1);

  let leadId: string;
  const existingLead = leadRows[0];

  if (!existingLead) {
    // Si no existía el lead, crearlo directamente en la etapa ganada
    const newLeadId = newId("lead");
    await db.insert(schema.lead).values({
      id: newLeadId,
      organizationId: contacto.organizationId,
      contactId: contacto.id,
      stageId: etapaInscrito.id,
    });
    leadId = newLeadId;
  } else {
    leadId = existingLead.id;
    // Si ya existía, moverlo mediante moveLeadToStage
    await moveLeadToStage({
      organizationId: contacto.organizationId,
      leadId,
      toStageId: etapaInscrito.id,
      actorUserId: null,
      source: "sistema",
    });
  }

  const detalle = [
    `✅ Inscripción web confirmada`,
    body.alumno ? `Alumno: ${body.alumno}` : null,
    body.categoria ? `Categoría: ${body.categoria}` : null,
    `Teléfono: ${body.phone}`,
  ]
    .filter(Boolean)
    .join(" · ");

  console.log(`[webhook-jaguares] Lead ${leadId} en "${etapaInscrito.name}": ${detalle}`);

  return Response.json({
    ok: true,
    resultado: "inscripcion_procesada",
    leadId,
    etapa: etapaInscrito.name,
    contacto: contacto.name,
    detalle,
  });
}
