import { ingestInboundMessage } from "@/server/inbox/ingest";
import { getCredentialsByAccountRef } from "@/server/whatsapp/credentials";
import {
  parseZernioEvent,
  sendZernioMessage,
  zernioSentAtSeconds,
  type ZernioEvent,
} from "@/server/zernio";

/**
 * WhatsApp que viaja por Zernio.
 *
 * La escuela ya usa Zernio para sus canales; conectar el número ahí evita
 * montar la app de Meta. El evento de Zernio no se parece al de Meta, así que
 * se normaliza aquí y de ahí en adelante corre el mismo núcleo de ingesta
 * (contacto, conversación, idempotencia, bus, agente).
 *
 * Lo que NO cambia: la ventana de 24 h, el sandbox del Laboratorio y el tope
 * de texto son los mismos de WhatsApp, porque el número sigue siendo WhatsApp.
 */

/**
 * Plataformas de Zernio que cuentan como WhatsApp.
 *
 * Se acepta cualquier nombre que lo contenga (`whatsapp`, `whatsapp_business`,
 * `whatsapp_coexistence`…): Zernio agrega variantes y descartar una en
 * silencio es el peor fallo posible — el webhook responde 200 y no hay nada
 * que investigar.
 */
function esWhatsapp(platform: string | undefined): boolean {
  const p = (platform ?? "").toLowerCase().replace(/[_-]/g, "");
  return p.includes("whatsapp") || p === "wa";
}

/**
 * ¿El evento es «mensaje recibido»?
 *
 * El panel de Zernio lo muestra traducido (`mensaje.recibido`), y no hay
 * garantía de que el campo `event` viaje en inglés. Se aceptan las dos formas
 * y sus variantes: perder un mensaje por la traducción de un slug sería un
 * fallo invisible (el webhook responde 200 y no entra nada).
 */
function esMensajeRecibido(evento: string | undefined): boolean {
  if (!evento) return false;
  const e = evento.toLowerCase();
  if (e === "message.received" || e === "mensaje.recibido") return true;
  const esMensaje = e.includes("message") || e.includes("mensaje");
  const esRecibido = e.includes("received") || e.includes("recibido");
  return esMensaje && esRecibido;
}

export async function processZernioWhatsappEvent(payload: unknown): Promise<void> {
  const evt = payload as ZernioEvent;
  if (!esWhatsapp(evt.account?.platform)) return;
  if (!esMensajeRecibido(evt.event)) {
    // Un evento de mensaje con OTRO nombre se descarta, pero se deja rastro:
    // si Zernio renombra el evento, el síntoma sería «nada llega» sin una
    // sola línea que lo explique.
    if (typeof evt.event === "string" && evt.event.includes("message")) {
      console.warn(
        `[wa-zernio] evento "${evt.event}" ignorado: no es un mensaje recibido`
      );
    }
    return;
  }
  if (evt.message?.direction && evt.message.direction !== "incoming") return;

  const accountRef = evt.account?.id;
  if (!accountRef) {
    console.warn("[wa-zernio] evento sin account.id: descartado");
    return;
  }

  const creds = await getCredentialsByAccountRef(accountRef);
  if (!creds) {
    console.warn(
      `[wa-zernio] evento para accountId desconocido (${accountRef}): ` +
        "guarda la conexión en Ajustes → WhatsApp para recibir mensajes"
    );
    return;
  }
  if (creds.source !== "zernio") {
    // Defensa en profundidad: sin Zernio configurado, un payload con su forma
    // no puede ser legítimo aunque llegue por la URL correcta.
    console.warn(
      `[wa-zernio] payload de Zernio en una conexión '${creds.source}': descartado`
    );
    return;
  }

  const ident = identidadWhatsapp(evt.message?.sender);
  if (!ident) {
    console.warn(`[wa-zernio] evento ${evt.id ?? "?"} sin sender.id: descartado`);
    return;
  }

  const zernioMessageId = evt.message?.id;
  if (!zernioMessageId) {
    console.warn(`[wa-zernio] evento ${evt.id ?? "?"} sin id de mensaje: descartado`);
    return;
  }

  // Solo texto por ahora: los adjuntos de Zernio se resuelven por su API y
  // quedan fuera de esta primera versión. Se registra para que nadie crea que
  // el mensaje se perdió sin explicación.
  const text = evt.message?.text ?? null;
  if (!text) {
    console.warn(
      `[wa-zernio] mensaje ${zernioMessageId} sin texto (adjunto): todavía no se ingieren adjuntos`
    );
    return;
  }

  await ingestInboundMessage({
    organizationId: creds.organizationId,
    identity: {
      identity: ident.identity,
      channel: "whatsapp",
      phone: ident.phone,
      waUserId: ident.bsuid,
      profileName: evt.message?.sender?.name ?? null,
    },
    // Prefijado para no colisionar jamás con un wamid de Meta en el índice
    // único de mensajes.
    waMessageId: `z_${zernioMessageId}`,
    type: "text",
    text,
    timestamp: zernioSentAtSeconds(evt.message?.sentAt),
    // Referencia del hilo en Zernio: por ella se responde.
    threadRef: evt.message?.conversationId ?? null,
  });
}

export type IdentidadWhatsapp = {
  identity: string;
  phone: string | null;
  bsuid: string | null;
};

/**
 * Quién escribe, según lo que manda Zernio.
 *
 * WhatsApp ya no siempre entrega el teléfono: en las cuentas con nombre de
 * usuario, el remitente viene como BSUID (`PE.2104265146857978`) y su
 * `username`. Tomar esos dígitos como teléfono inventaba un número que no
 * existe y rompía el cruce con la vía de Meta. Aquí se decide en un solo
 * sitio, con la misma convención que usa la ingesta de Meta (`bsuid:<id>`),
 * para que la misma persona caiga en el mismo contacto por las dos vías.
 */
export function identidadWhatsapp(
  sender: { id?: string | null } | undefined
): IdentidadWhatsapp | null {
  const crudo = (sender?.id ?? "").trim();
  if (!crudo) return null;

  // BSUID: dos letras de país, punto y dígitos.
  if (/^[A-Za-z]{2}\.\d{6,}$/.test(crudo)) {
    return { identity: `bsuid:${crudo}`, phone: null, bsuid: crudo };
  }

  // Teléfono de verdad: solo dígitos (se toleran +, espacios y guiones).
  const limpio = crudo.replace(/[\s+()-]/g, "");
  if (/^\d{10,15}$/.test(limpio)) {
    return { identity: limpio, phone: limpio, bsuid: null };
  }

  // Cualquier otra identidad del canal: se guarda opaca, sin inventar teléfono.
  return { identity: `zernio:${crudo}`, phone: null, bsuid: null };
}

/**
 * Responde en una conversación de WhatsApp que vive en Zernio.
 *
 * Igual que en Instagram y Messenger, sin `threadRef` no hay a dónde mandar:
 * Zernio responde dentro de SU conversación, no a un número suelto.
 */
export async function sendZernioWhatsappText(input: {
  token: string;
  accountRef: string | null;
  threadRef: string | null;
  text: string;
  idempotencyKey?: string;
}): Promise<string> {
  const res = await sendZernioMessage({
    token: input.token,
    accountId: input.accountRef,
    conversationId: input.threadRef,
    text: input.text,
    idempotencyKey: input.idempotencyKey,
  });
  return res.platformMessageId;
}

/** Secreto de firma de la cuenta que manda el evento, para validarla antes. */
export async function resolveZernioWhatsappSecret(rawBody: string): Promise<{
  secret: string | null;
  accountRef: string | null;
  esWhatsapp: boolean;
}> {
  const evt = parseZernioEvent(rawBody);
  const accountRef = evt?.account?.id ?? null;
  if (!accountRef) return { secret: null, accountRef: null, esWhatsapp: false };
  const creds = await getCredentialsByAccountRef(accountRef);
  return {
    secret: creds?.webhookSecret ?? null,
    accountRef,
    esWhatsapp: esWhatsapp(evt?.account?.platform),
  };
}
