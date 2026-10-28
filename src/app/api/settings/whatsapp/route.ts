import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  desconectarCanal,
  getCredentialsByOrg,
  saveCredentials,
  saveZernioCredentials,
  tokenLast4,
} from "@/server/whatsapp/credentials";
import {
  registerWebhookForNumber,
  testConnection,
  unregisterWebhookForNumber,
} from "@/server/whatsapp/connect";
import {
  webhookPath,
  webhookUrl,
  webhookVerifyToken,
} from "@/server/whatsapp/webhook-url";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const creds = await getCredentialsByOrg(session.organizationId);
  if (!creds) return Response.json({ connection: null });
  return Response.json({
    connection: {
      source: creds.source,
      accountRef: creds.accountRef,
      wabaId: creds.wabaId,
      phoneNumberId: creds.phoneNumberId,
      displayPhoneNumber: creds.displayPhoneNumber,
      verifiedName: creds.verifiedName,
      status: creds.status,
      tokenLast4: tokenLast4(creds.token),
    },
  });
});

const zernioPutSchema = z.object({
  source: z.literal("zernio"),
  accountRef: z.string().trim().min(1),
  token: z.string().trim().min(1),
  webhookSecret: z.string().trim().optional(),
  displayPhoneNumber: z.string().trim().optional(),
});

const metaPutSchema = z.object({
  source: z.literal("meta").optional(),
  wabaId: z.string().trim().min(1),
  phoneNumberId: z.string().trim().min(1),
  token: z.string().trim().min(1),
});

const putSchema = z.union([zernioPutSchema, metaPutSchema]);

export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  if (body.data.source === "zernio") {
    await saveZernioCredentials({
      organizationId: session.organizationId,
      accountRef: body.data.accountRef,
      token: body.data.token,
      webhookSecret: body.data.webhookSecret,
      displayPhoneNumber: body.data.displayPhoneNumber,
    });
    return Response.json({
      ok: true,
      source: "zernio",
      displayPhoneNumber: body.data.displayPhoneNumber,
    });
  }

  const check = await testConnection(body.data.phoneNumberId, body.data.token);
  if (!check.ok) {
    const status = check.code === "meta_unavailable" ? 503 : 422;
    return apiError(status, check.code, check.message);
  }

  await saveCredentials({
    organizationId: session.organizationId,
    wabaId: body.data.wabaId,
    phoneNumberId: body.data.phoneNumberId,
    token: body.data.token,
    displayPhoneNumber: check.displayPhoneNumber,
    verifiedName: check.verifiedName,
  });

  const webhook = await registerWebhookForNumber({
    wabaId: body.data.wabaId,
    phoneNumberId: body.data.phoneNumberId,
    token: body.data.token,
    webhookUrl: webhookUrl("wa"),
    verifyToken: webhookVerifyToken(),
  });

  return Response.json({
    ok: true,
    displayPhoneNumber: check.displayPhoneNumber,
    webhook,
  });
});

/**
 * Desconectar el número. Sin esto, conectar era una calle de un solo
 * sentido: la unicidad del número impedía moverlo a otra instancia y no había
 * pantalla donde soltarlo.
 *
 * Primero quita el override del webhook que puso el guardado —con el token
 * todavía a mano; sin él no se podría— y después borra las credenciales. No
 * borra la bandeja: las conversaciones son de la organización, no de la
 * conexión. Idempotente: sin conexión responde 200 igual.
 */
export const DELETE = withAuth(async (session) => {
  const creds = await getCredentialsByOrg(session.organizationId);
  if (creds && creds.phoneNumberId) {
    await unregisterWebhookForNumber({
      phoneNumberId: creds.phoneNumberId,
      token: creds.token,
      webhookPath: webhookPath("wa"),
    });
  }
  await desconectarCanal(session.organizationId);
  return Response.json({ ok: true });
});
