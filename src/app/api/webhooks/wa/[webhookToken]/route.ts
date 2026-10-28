import { getEnv } from "@/lib/env";
import { isValidSignature, isValidWebhookToken } from "@/server/inbox/webhook";
import {
  isValidZernioSignature,
  parseZernioEvent,
  zernioSignatureFrom,
} from "@/server/zernio";
import { resolveZernioWhatsappSecret } from "@/server/whatsapp/zernio";
import { recibirEvento } from "@/server/webhooks/recibir";

/**
 * Webhook público de WhatsApp (contrato webhook.md).
 * Capa 1: el segmento [webhookToken] debe coincidir (si no → 404 sin efectos).
 * Capa 2: firma x-hub-signature-256 solo si META_APP_SECRET está configurado.
 *
 * La misma URL recibe los dos caminos: Meta (Cloud API) y Zernio cuando el
 * número vive allí. Se distinguen por la FORMA del cuerpo (`account` es de
 * Zernio), no por la URL: obligar a dos endpoints sería una configuración más
 * que recordar y un modo de fallo silencioso si alguien pega la equivocada.
 *
 * 047: para ambos caminos, el evento se guarda ANTES de responder 200 y se
 * procesa fuera de la ruta; si falla, el barrido lo reintenta. Si no se pudo
 * guardar, 503 para que la fuente reintente (`src/server/webhooks/recibir.ts`).
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ webhookToken: string }> };

export async function GET(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response(null, { status: 403 });
}

export async function POST(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const env = getEnv();
  if (!isValidWebhookToken(webhookToken, env.META_WEBHOOK_VERIFY_TOKEN)) {
    return new Response(null, { status: 404 });
  }

  const rawBody = await req.text();

  // 1) ¿Es un evento de Zernio? Se detecta por la forma del cuerpo (`account`),
  //    antes de pedir la firma de Meta (que en una instalación solo-Zernio ni
  //    siquiera existe). La misma URL sirve a Meta y a Zernio: no hay que
  //    configurar dos endpoints ni recordar cuál es cuál.
  const zernioEvento = parseZernioEvent(rawBody);
  if (zernioEvento) {
    const { secret, esWhatsapp } = await resolveZernioWhatsappSecret(rawBody);
    if (!esWhatsapp) return Response.json({ received: true });
    if (
      !isValidZernioSignature(
        rawBody,
        zernioSignatureFrom(req.headers),
        secret
      )
    ) {
      return new Response(null, { status: 401 });
    }
    return recibirEvento("zernio", zernioEvento, rawBody, "wa");
  }

  // 2) Camino de Meta: firma + cola resistente a fallos (047).
  const signature = req.headers.get("x-hub-signature-256");
  if (!isValidSignature(rawBody, signature, env.META_APP_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // body ilegible: 200 igualmente (Meta reintenta y termina desactivando)
    return Response.json({ received: true });
  }

  return recibirEvento("whatsapp", payload, rawBody, "webhook");
}
