# Jaguares CRM

Adaptación de [Vocero CRM](https://vocerocrm.com) 1.5.0 (MIT) para la **Escuela
Deportiva Jaguares**. Misma base probada —bandeja en tiempo real, embudo,
agente de IA y Laboratorio— con la marca, el dominio y los canales de la
escuela.

No es un rebranding cosmético: el CRM habla de alumnos, categorías, cupos y
mensualidades en soles, y su agente responde con los horarios y precios reales
de la escuela.

## Arrancarlo

```bash
# 1. Base de datos (Postgres 16 en el puerto 5433)
docker compose -f docker-compose.dev.yml up -d

# 2. Dependencias y migraciones
pnpm install
pnpm db:migrate

# 3. La app
pnpm dev            # http://localhost:3010 (PORT=3010 en el .env)
```

El primer registro crea la organización y siembra el embudo de inscripción. Para
cargar los datos de ejemplo (8 apoderados, 12 entradas de conocimiento y una
corrida del Laboratorio con sus hallazgos) usa el botón de la pantalla de inicio
o `POST /api/seed/demo`.

## Qué cambió respecto de Vocero

| Área | Antes | Ahora |
|---|---|---|
| Marca | Azul Vocero, «v» caligráfica | Negro y oro del jaguar, emblema de tres zarpazos, tipografía Archivo |
| Moneda | MXN | **PEN** (S/), formato `es-PE` |
| Embudo | Nuevo → En conversación → Interesado → Cliente → Perdido | Nuevo → Interesado → Datos completos → **Clase de prueba** → Inscrito → Perdido |
| Conocimiento | Ferretería (taladros, cemento) | Disciplinas, categorías, horarios, planes y formas de pago de la escuela |
| Agente | «Martillito» | «Jagua», asistente de la escuela |
| IA | OpenRouter por defecto | **DeepSeek** de primera clase (`deepseek-flash` / `deepseek-v4-pro`) |
| WhatsApp | Solo Cloud API de Meta | Cloud API **o Zernio**, elegible en Ajustes → WhatsApp |
| Pantalla nueva | — | **Cupos**: horarios y vacantes leídos del sistema de la escuela |

Detalles de diseño: los tokens viven en `src/app/globals.css` y los acentos se
calculan en `src/lib/branding.ts`. `tests/unit/contraste-temas.test.ts` mide los
pares reales y falla si un retoque rompe la legibilidad en cualquiera de los dos
temas.

## Conectar WhatsApp

Hay dos caminos para el mismo número; se eligen en **Ajustes → WhatsApp**.

### Por Zernio (recomendado si el número ya está ahí)

1. En el panel de Zernio, anota el `account.id` de la cuenta de WhatsApp
   (WhatsApp → Overview, el botón de copiar junto a *Account ID*) y crea una
   llave de API.
2. En el CRM: **Ajustes → WhatsApp → WhatsApp por Zernio**. Pega el
   `account.id`, la llave y, si Zernio te da uno, el secreto de firma.
3. Copia la URL del webhook que aparece en esa tarjeta y dála de alta en Zernio
   con el evento `message.received`.

**La URL del webhook tiene que ser pública.** Zernio entrega desde internet:
`http://localhost:3010/...` no le sirve. Para probar en tu máquina, expón el CRM
con un túnel (cloudflared, ngrok) y pon esa dirección en `APP_BASE_URL`; en
producción, tu dominio. La tarjeta avisa cuando la URL sigue siendo local.

El webhook es el mismo para Meta y para Zernio (`/api/webhooks/wa/<token>`): el
CRM distingue el origen por la forma del cuerpo, así que no hay dos URLs que
confundir. Acepta `whatsapp`, `whatsapp_business` y `whatsapp_coexistence`.

**Números en coexistencia:** si Zernio marca *Sending limited — business not
verified*, los mensajes **entran** igual al CRM, pero los envíos pueden fallar
hasta que Meta verifique el negocio. El error que devuelve Zernio se guarda en
el mensaje, así que se ve en el hilo en vez de desaparecer.

### Por Meta (Cloud API oficial)

El asistente de siempre: WABA ID, Phone Number ID y token. El CRM registra el
webhook en el número automáticamente.

En ambos caminos el número sigue siendo WhatsApp: la ventana de 24 h, las
plantillas y el tope de texto se respetan igual.

**Límite conocido:** por Zernio todavía no se envían adjuntos ni ubicaciones, y
no se pueden mandar plantillas. Esos envíos se rechazan con un mensaje claro en
lugar de fallar en silencio.

## Configurar DeepSeek

Dos formas, la primera manda:

1. **Ajustes → IA**: proveedor «DeepSeek», modelo `deepseek-flash`, llave. El
   botón *Probar conexión* la valida y *Traer modelos* lista los disponibles.
2. **Entorno**: `DEEPSEEK_API_KEY` en `.env`. Si existe, se usa como respaldo
   cuando no hay nada guardado en Ajustes.

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-flash
```

Los nombres de modelo que DeepSeek acepta hoy son `deepseek-flash` (rápido y
barato, el que conviene para WhatsApp) y `deepseek-v4-pro` (razona más, tarda y
cuesta más). Un nombre viejo como `deepseek-chat` devuelve un `400` que lista
los válidos: si lo ves, corrige el campo **Modelo**.

## Cupos: leer el sistema de la escuela

`ESCUELA_API_URL` apunta al backend Express de la escuela
(`jaguares-cms-dev/server`, puerto 3003 en local;
`https://api.jaguarescar.com` en producción). La pantalla **Cupos**
consulta `GET /api/horarios`, agrupa por disciplina/categoría/hora y muestra las
vacantes por día. Cada tarjeta se puede copiar como una línea de chat.

- El CRM **solo lee**. Inscribir, cobrar y marcar asistencia siguen siendo
  trabajo del sistema de la escuela.
- Si el backend está apagado, la pantalla lo explica y el resto del CRM sigue
  funcionando: la integración es de lectura y opcional.

### Qué lee el CRM de la escuela (y qué no)

La regla es una: **el CRM no tiene credenciales de MySQL**. Lee la API pública
del backend, que ya devuelve solo lo que es público en la web.

| Se lee | No se lee |
|---|---|
| `GET /api/horarios`: deporte, categoría, día, hora, cupo máximo y ocupado, plan y precio | alumnos, apoderados, DNI, inscripciones, pagos, asistencias |

No es un filtro que se aplica después: esa consulta no pide esas columnas, y el
CRM no puede pedirlas porque no tiene acceso a la base. Un bug o una inyección
en el CRM no puede sacar datos de alumnos.

El agente recibe ese catálogo como **datos en vivo**, con prioridad sobre el
conocimiento escrito y cacheado 5 minutos; si la API no responde, el turno
sigue con el conocimiento base. Las reglas del prompt son explícitas: si una
disciplina no aparece en el catálogo, el agente no la ofrece ni inventa
horarios.

**Consulta de un alumno concreto** (¿está inscrito?, ¿pagó?) es otra cosa: exige
autenticación, expone datos personales y no debería hacerlo un agente de
WhatsApp. Para eso están la consulta con DNI de la web y la atención humana.
Si alguien pregunta por un alumno, el agente lo dice y **sigue atendiendo**: no
traspasa la conversación por eso. Un traspaso apaga al agente hasta que una
persona lo reactive, y dejar al cliente esperando por una sola pregunta es peor
que responderle que no puede verlo.

## Qué sabe el agente (y qué no)

El conocimiento escrito quedó reducido a lo que **no** está en el sistema:
las formas de pago (Yape, Plin, transferencia), la referencia de precios por
plan, cómo es el proceso de inscripción y que existe clase de prueba. Los
horarios, categorías, cupos, planes y precios de cada clase **no** se escriben
aquí: se leen en vivo del sistema de la escuela.

Fue una limpieza deliberada: la lista escrita se cargó desde la landing y
ofrecía programas que el sistema no tiene abiertos (básquet, por ejemplo), así
que el agente inventaba horarios. Ahora, si no está en el catálogo en vivo, no
se ofrece.

**Huecos intencionales** (el Laboratorio los encuentra en la primera corrida):
dirección de la sede, descuentos por hermanos, política de recuperación de
clases y qué debe llevar el alumno. Se completan en **Agente → Conocimiento**;
hasta entonces el agente debe decir que lo confirma, no inventarlo.

## Cómo responde

El agente escribe como el equipo de atención de un club grande, no como un
chatbot: mensajes de dos o tres líneas, hasta tres opciones en viñetas de una
línea y **una sola pregunta** al final (normalmente la clase de prueba). Nada de
títulos, tablas ni `**negritas**` de markdown.

Eso se sostiene en tres piezas:

- **Guía de estilo en el prompt** (`src/server/ai/prompts.ts`), con la forma
  esperada escrita como ejemplo.
- **Normalización del texto** (`src/lib/whatsapp-format.ts`): convierte el
  markdown al formato de WhatsApp, unifica viñetas y quita saltos de más.
- **Partido en dos burbujas** cuando la respuesta pasa de 600 caracteres, con
  una pausa entre ellas: primero el resumen, después el detalle.

**Cuánto tarda:** unos 3 s de espera deliberada (`AGENT_COALESCE_MS`, para unir
una ráfaga en un solo turno) + lo que tarde el modelo (2 a 6 s con
`deepseek-flash`) + el envío. Si se baja a 0, contesta antes pero puede
responder dos veces a quien escribe en dos partes.

## Verificación

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

1014 pruebas unitarias en verde. Las capturas de `docs/capturas/` se generaron
contra la app real con datos sembrados (claro, oscuro y móvil).

## Pendientes conocidos

- Adjuntos y plantillas por Zernio (hoy se rechazan con aviso).
- La ficha del alumno tiene campos sugeridos pendientes de formulario; hoy se
  llena a mano o la llena el agente.
- El backend de la escuela en este equipo no conectó a su MySQL (credenciales
  del `.env` desactualizadas), así que la pantalla Cupos se verificó en su
  estado de error. La integración en sí está probada por unidad.
