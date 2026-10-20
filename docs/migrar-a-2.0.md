# Migrar a Vocero 2.0

En la 2.0 **el agente sale del CRM**. Vocero se queda con lo suyo —bandeja,
pipeline, agenda, perfil del agente, conocimiento, Laboratorio— y quien
contesta es un cerebro aparte, conectado por un contrato público:
[Nea](https://github.com/kevinrivm/nea-agent) (MIT) u otro.

Es una versión mayor porque hay algo que hacer a mano. Qué, depende de dónde
vienes.

| Vienes de | Qué haces |
|---|---|
| **Solo el agente incluido** | Levantas Nea al lado del CRM (abajo, «El par») y le das el despacho. El perfil, el conocimiento y el Laboratorio no se tocan: ya viven en el CRM. |
| **Nea 1.x delante del CRM** | Nada obligatorio: Nea 1.x frente a Vocero 2.0 sigue funcionando, porque `/api/bot/*` no cambió. Para pasar al despacho (y que Nea conteste Instagram, Messenger y TikTok): actualiza Nea, dale el despacho y **recupera el webhook** (abajo). |
| **Tu propio cerebro sobre `/api/bot/*`** | Nada. Recibir el despacho es opcional; el contrato está en [`docs/openapi.json`](openapi.json). |

## El par: CRM + Nea

Nea es un servicio al lado del CRM. Comparten la base: Nea guarda sus tablas
en su propio esquema (`nea`) y no toca las del CRM. El CRM le **despacha** a
Nea cada ráfaga del cliente, firmada con `BOT_API_KEY`, y Nea contesta por
`/api/bot/*` con esa misma llave. Meta y Zernio le hablan solo al CRM.

### docker compose

En tu `.env`:

```bash
BOT_API_KEY=            # openssl rand -hex 32
BRAIN_DISPATCH_URL=http://nea:8000/vocero/dispatch
BRAIN_HEALTH_URL=http://nea:8000/health
# La llave de IA de Nea: sin esta, usa OPENROUTER_API_TOKEN.
NEA_LLM_API_KEY=
```

Y levanta el par:

```bash
docker compose --profile nea up -d
```

Mientras se publica la imagen 2.0.0 de Nea, el servicio va detrás del perfil
`nea`; con el cierre de la 2.0 se levanta siempre.

### Coolify

Dentro del proyecto del CRM, un servicio más desde la imagen
`ghcr.io/kevinrivm/nea-agent:2.0.0`, puerto 8000, sin dominio público:

| Variable de Nea | Valor |
|---|---|
| `CRM_BASE_URL` | La dirección interna del CRM (`http://<servicio>:3000`) |
| `CRM_BOT_API_KEY` | El `BOT_API_KEY` del CRM |
| `DATABASE_URL` | La misma del CRM |
| `DATABASE_SCHEMA` | `nea` |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | Tu proveedor de IA |

En el CRM, `BRAIN_DISPATCH_URL` y `BRAIN_HEALTH_URL` hacia Nea, y **redeploy**
(un reinicio no carga variables nuevas).

### Render, Fly y Railway

`render.yaml` trae el servicio de Nea comentado, listo para descomentar.
`fly.toml` y `railway.toml` dicen en sus comentarios cómo levantar a Nea como
segunda app de la red privada.

## Recuperar el webhook (si venías con Nea 1.x)

Nea 1.x recibía el webhook de Meta por un override (en el número o en la
WABA). En la 2.0 el webhook es del CRM. Desde Configuración → WhatsApp:

1. **Registrar en Meta.** Si la cuenta tiene un override ajeno en la WABA, el
   CRM lo respeta y te dice a qué host.
2. **Recuperar el webhook.** Quita ese override de la WABA y deja el del
   número hacia el CRM. La pantalla te pide confirmar: desde ese momento, los
   mensajes dejan de llegar a donde apuntaba el override.

Si lo prefieres a mano, con la Graph API: el mismo `POST /{PHONE_NUMBER_ID}`
con `"override_callback_uri": ""` para quitar el del número de Nea, y vuelve a
guardar la conexión en Configuración → WhatsApp.

Si actualizas Nea antes de mover el webhook no se pierde nada: Nea 2.0 le
contesta 503 a Meta para que reintente, y su `/health` enseña
`webhookDeMeta.ultimoEn` hasta que lo muevas.

## Lo que se va de Nea

`META_APP_SECRET`, `VERIFY_TOKEN`, `CRM_WEBHOOK_URL`,
`RELAY_BACKOFF_CAP_SECONDS`, `COALESCE_SECONDS`, `TYPING_DELAY_SECONDS` y
`TURN_RETRY_DELAYS` ya no se leen. Si siguen en el entorno, Nea lo avisa al
arrancar. Detalle en el
[CHANGELOG de Nea](https://github.com/kevinrivm/nea-agent/blob/main/CHANGELOG.md).

## El contrato

- [`docs/openapi.json`](openapi.json), servido también por tu instancia en
  `GET /api/bot/openapi.json`: las rutas de `/api/bot/*` y, en `webhooks`, el
  despacho y el aviso de olvido.
- La regla: **agregar una llave cabe; quitar o renombrar, no**. Ignora las
  llaves que no conozcas. Un cambio que rompa es una versión mayor.
- Las pruebas gemelas fijan el cuerpo y la firma del despacho y del olvido
  byte a byte en los dos repositorios: cambiar un lado sin el otro rompe una
  prueba, no una instalación.

Lo que la 2.0 agregó al contrato:

| Qué | Dónde |
|---|---|
| `adOrigen` | `GET /api/bot/context` |
| `fileName`, `location`, `contacts` | Mensajes del despacho, solo cuando aplican |
| `conversation.test` | Despacho de una corrida del Laboratorio |
| Respuesta de prueba guardada (200 en vez de 409 `sandbox_violation`) | `POST /api/bot/messages` |
| `role`, `tools` | `GET /api/bot/profile` |
