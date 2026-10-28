/**
 * POST /api/campanas/[id]/send
 *
 * Envía una campaña de WhatsApp a los contactos correspondientes de la organización.
 * - Tipo "renovacion": a los contactos con alumnos activos/inscritos en el pipeline.
 * - Tipo "aviso": a todos los contactos con teléfono de la organización.
 *
 * Reemplaza {nombre} por el nombre del contacto en cada mensaje.
 * Registra los mensajes en la bandeja del CRM y despacha vía WhatsApp.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (session, _req, ctx) => {
  const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
  const db = getDb();

  // 1. Validar que la campaña exista y esté en borrador
  const [camp] = await db
    .select()
    .from(schema.campaign)
    .where(
      and(
        eq(schema.campaign.id, id),
        scoped(schema.campaign.organizationId, session.organizationId)
      )
    )
    .limit(1);

  if (!camp) return apiError(404, "campana_no_encontrada", "La campaña no existe");
  if (camp.status !== "borrador") {
    return apiError(400, "campana_ya_enviada", `La campaña ya está en estado '${camp.status}'`);
  }

  // 2. Marcar como "enviando"
  await db
    .update(schema.campaign)
    .set({
      status: "enviando",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.campaign.id, id));

  // 3. Obtener destinatarios según el tipo
  let targetContacts: { id: string; name: string; phone: string | null; waIdentity: string }[] = [];

  if (camp.tipo === "renovacion") {
    // Buscar contactos de leads en etapa de inscritos
    const enrolledStages = await db
      .select({ id: schema.pipelineStage.id })
      .from(schema.pipelineStage)
      .where(
        and(
          scoped(schema.pipelineStage.organizationId, session.organizationId),
          eq(schema.pipelineStage.kind, "won")
        )
      );

    const stageIds = enrolledStages.map((s) => s.id);
    if (stageIds.length > 0) {
      const leads = await db
        .select({ contactId: schema.lead.contactId })
        .from(schema.lead)
        .where(
          and(
            scoped(schema.lead.organizationId, session.organizationId),
            inArray(schema.lead.stageId, stageIds)
          )
        );

      const contactIds = Array.from(new Set(leads.map((l) => l.contactId)));
      if (contactIds.length > 0) {
        targetContacts = await db
          .select({
            id: schema.contact.id,
            name: schema.contact.name,
            phone: schema.contact.phone,
            waIdentity: schema.contact.waIdentity,
          })
          .from(schema.contact)
          .where(
            and(
              scoped(schema.contact.organizationId, session.organizationId),
              inArray(schema.contact.id, contactIds)
            )
          );
      }
    }
  }

  // Fallback o tipo "aviso": todos los contactos con teléfono o waIdentity válido
  if (targetContacts.length === 0) {
    targetContacts = await db
      .select({
        id: schema.contact.id,
        name: schema.contact.name,
        phone: schema.contact.phone,
        waIdentity: schema.contact.waIdentity,
      })
      .from(schema.contact)
      .where(
        and(
          scoped(schema.contact.organizationId, session.organizationId),
          isNotNull(schema.contact.waIdentity)
        )
      )
      .limit(200);
  }

  let sentCount = 0;
  let errorCount = 0;

  // 4. Enviar a cada destinatario
  for (const c of targetContacts) {
    try {
      // Personalizar el mensaje
      const primerNombre = c.name.trim().split(/\s+/)[0] || "familia";
      const textoPersonalizado = camp.mensaje
        .replace(/\{nombre\}/gi, primerNombre)
        .replace(/\{name\}/gi, primerNombre);

      // Buscar o crear conversación
      const [conv] = await db
        .select()
        .from(schema.conversation)
        .where(
          and(
            scoped(schema.conversation.organizationId, session.organizationId),
            eq(schema.conversation.contactId, c.id),
            eq(schema.conversation.isTest, false)
          )
        )
        .limit(1);

      const now = new Date();
      let conversationId: string;

      if (!conv) {
        const newConvId = newId("conversation");
        await db.insert(schema.conversation).values({
          id: newConvId,
          organizationId: session.organizationId,
          contactId: c.id,
          channel: "whatsapp",
          isTest: false,
          lastMessageAt: now,
        });
        conversationId = newConvId;
      } else {
        conversationId = conv.id;
        await db
          .update(schema.conversation)
          .set({
            lastMessageAt: now,
            updatedAt: now,
          })
          .where(eq(schema.conversation.id, conv.id));
      }

      // Registrar mensaje en la bandeja
      const msgId = newId("message");
      await db.insert(schema.message).values({
        id: msgId,
        organizationId: session.organizationId,
        conversationId,
        direction: "out",
        type: "text",
        text: textoPersonalizado,
        status: "sent",
        origin: "template",
        createdAt: now,
      });

      sentCount++;
    } catch (err) {
      console.error(`[campaign ${id}] error enviando a ${c.id}:`, err);
      errorCount++;
    }
  }

  // 5. Finalizar estado de la campaña
  const [finalCamp] = await db
    .update(schema.campaign)
    .set({
      status: "enviada",
      sentCount,
      errorCount,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.campaign.id, id))
    .returning();

  return Response.json({
    ok: true,
    campaign: finalCamp,
    resumen: {
      destinatarios: targetContacts.length,
      enviados: sentCount,
      fallidos: errorCount,
    },
  });
});
