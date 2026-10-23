# Bitácora — Vocero 2.2

Construir aprendiendo de los mejores, no piratear. Qué repo inspiró cada
función y con qué licencia, qué vio REA, cuánto tardó cada fase y qué salió
mal. Solo lo medido: horas reales (hora de México, UTC−6) y cifras sacadas de
una herramienta. Nunca valores de secretos.

## 2026-10-22 — Fase 1: el estudio (046)

**Rama**: `feat/046-referencias-2.2`, desde `origin/main` 2.1.0 (`9940226`).
**Entregable**: [`specs/046-referencias-2.2/research.md`](../specs/046-referencias-2.2/research.md).

### Tiempos

| Paso | Inicio | Fin | Duró |
|---|---|---|---|
| Fase 1 completa | 22:08:19 | 22:57:16 | 48 min 57 s |
| Rama, lectura de la guía y del webhook | 22:08:19 | ~22:09 | — |
| Licencias de los 7 candidatos + 6 extra (API de GitHub) | ~22:09 | ~22:10 | — |
| Descarga de Chatwoot (4 imágenes) | 22:10:01 | 22:11:45 | 1 min 44 s |
| Chatwoot arriba (contenedor de la app) | 22:12:50 | — | — |
| Capturas de Chatwoot (19, más un HAR) | 22:15:22 | 22:53:00 | — |
| libredesk: primer arranque (falló, ver abajo) → arriba | 22:13:28 | 22:31:31 | 18 min, casi todos esperando |
| Capturas de libredesk (15) | 22:31:58 | 22:34:47 | 2 min 49 s |
| Estudio de wacrm, DeskcommCRM y whatsapp-saas (subagente, solo `gh api`) | — | — | 7 min 38 s (medido por la herramienta) |
| Frappe CRM: `compose up` → contenedor | 22:35:17 | 22:37:33 | — |
| Frappe CRM: `bench` dentro del contenedor → sitio listo | 22:37:33 | 22:44:34 | ~7 min (con un fallo de por medio) |
| Twenty: contenedor → migraciones listas | 22:40:41 | 22:42:23 | 1 min 42 s |
| Capturas de Twenty (13) | 22:44:48 | 22:48:30 | 3 min 42 s |
| Capturas de Frappe CRM (10) | 22:51:17 | 22:52:03 | — |
| Matriz, ranking y plan en `research.md` | 22:54 | 22:57 | — |

Los candidatos corrieron **en paralelo**: por eso las filas se enciman.

### Qué repo inspira qué

Ver la matriz y el plan en el `research.md`. Resumen:

| Spec propuesta | Inspiración | Licencia |
|---|---|---|
| 047 Webhook a prueba de fallos | whatsapp-saas (patrón de reintento) + el outbox propio (021) | MIT |
| 048 PWA | Chatwoot, DeskcommCRM | MIT |
| 049 Respuestas rápidas con «/» | Chatwoot, DeskcommCRM, wacrm | MIT |
| 050 Notas internas en el hilo | Chatwoot, DeskcommCRM, whatsapp-saas | MIT |
| 051 Borrador por conversación | Chatwoot (lo encontró REA) | MIT |
| 052 Filtros «por vencer» y «sin responder» | wacrm | MIT |

Lo que solo se observó (libredesk, Frappe CRM y Twenty, AGPL) aporta
comportamientos que se reconstruyen desde la descripción:

- la barra de comandos con acciones;
- la banda «Connecting…»;
- los filtros rápidos sobre el kanban;
- la fila de cálculo de la tabla;
- los registros vistos que dejan de ir en negrita.

### Qué vio REA que no se veía a simple vista

- **Chatwoot guarda el borrador de cada conversación** en `localStorage`
  (`draftMessages`). Vocero lo tira al cambiar de chat. De ahí sale la 051.
- **Chatwoot cachea el catálogo en IndexedDB** (`cw-store-1`) y valida con
  `GET /cache_keys`. En el HAR, la segunda carga contestó en 1 ms.
- **«Alguien está escribiendo» entre agentes**: Chatwoot manda
  `toggle_typing_status` mientras tecleas y `update_last_seen` al leer (HAR, 148
  peticiones).
- **La PWA de Chatwoot es mínima**: un `sw.js` de 35 líneas que solo atiende
  `push` y `notificationclick`, sin caché de datos. **libredesk registra un
  service worker pero no tiene manifest**: notifica, pero no se instala.
- **El contenedor de libredesk sale a internet** para validar credenciales con
  Meta («Meta rejected these credentials…»). Aislar a `127.0.0.1` cerró los
  puertos, no la salida.

### Medido: el peso de cada uno

Con `docker stats --no-stream` a las 22:54, en reposo y con datos demo:

| | Imagen | RAM total |
|---|---|---|
| Vocero | 334 MB | 115 MiB |
| libredesk | 73,9 MB | 128 MiB |
| Frappe CRM | 3,83 GB | 614 MiB |
| Chatwoot | 2,73 GB | 1 104 MiB |
| Twenty | 1,85 GB | 1 862 MiB |

### Capturas

52 PNG en `scratch/046-referencias/` (fuera de git: llevan marca de
terceros), más la captura de REA `chatwoot/rea-cw-conversacion.png` (sha256
`3e887f4f…dea1`, 1422×804). Las de antes y después de cada función llegan en
la Fase 2, y esas sí son de Vocero.

### Lo que salió mal

1. **No se podía cambiar de rama**: había cambios locales sin commitear en
   `.gitignore` y `.mcp.json`. Se guardaron con `git stash`, se creó la rama y
   se reaplicaron intactos.
   - **Ojo**: ese `.mcp.json` tiene un token de Coolify en claro y **sigue
     rastreado por git**. Agregarlo a `.gitignore` no lo saca del índice: no
     debe entrar en ningún commit.
2. **Chatwoot llevaba a su asistente de instalación** en vez de la bandeja. Se
   saltó borrando la marca de onboarding desde `rails runner`.
3. **Las capturas de Playwright se colgaban 30 s en Chatwoot**: hay fuentes y
   un websocket siempre activo, y `networkidle` nunca llegaba. Se cambió a
   `Page.captureScreenshot` por CDP y a esperar `load`.
4. **Dos recorridos compartieron la misma pestaña** (Chatwoot en segundo plano
   y libredesk a la vez) y se mezclaron las capturas. Se borraron y se
   repitieron en una pestaña propia.
5. **libredesk arrancó antes que su base** y murió («connection refused»). Se
   levantó otra vez.
   - **No hay conversaciones demo en libredesk**: su inbox de WhatsApp exige
     credenciales reales de Meta y el de chat web no se creó. Se observó la
     estructura (admin, Ctrl+K, vistas, oscuro, móvil) con la bandeja vacía.
6. **Frappe CRM no creó su sitio**: el cliente de MariaDB del `bench` exige
   SSL y MariaDB 10.8 no lo da. Se cambió a 11.4.
   - Después, su asistente inicial bloqueaba todas las pantallas. Se marcó
     `FCRM Settings.setup_completed`.
   - El monto de los tratos no se guardó por la API (salen en $0.00).
7. **`curl` en Git Bash rompió los acentos** del JSON al sembrar Frappe
   («'bytes' object has no attribute 'pop'»). Se sembró con Node.
8. **Twenty solo funciona en el host de `SERVER_URL`** (`localhost`, no
   `127.0.0.1`).
9. **REA**:
   - `inspect_web_page` y `capture_web_screenshot` devuelven más de lo que
     cabe en una respuesta de herramienta. Se leyeron del archivo de
     resultados.
   - `compare_web_screenshots` pide las imágenes en línea y no sirve con
     capturas completas: para la Fase 2 hay que comparar recortes.
   - `inspect_web_page` no ve el tráfico anterior a engancharse.

### Siguiente

Kevin elige en el `research.md` qué specs entran a la 2.2. Hasta entonces no
se escribe código del producto. Los contenedores de referencia quedan
detenidos con sus volúmenes, para volver a observarlos en la Fase 2.

## 2026-10-23 — Elección de Kevin

A las 06:19 Kevin eligió el recorte sugerido: **047 a 052**. Quedó anotado en
el `research.md` y se publicó en el PR #146.

## 2026-10-23 — 047: webhook a prueba de fallos

**Rama**: `feat/047-webhook-a-prueba-de-fallos`, sobre `feat/046-referencias-2.2`.
**Spec**: [`specs/047-webhook-a-prueba-de-fallos/`](../specs/047-webhook-a-prueba-de-fallos/spec.md),
en ciclo completo. La spec se commiteó a las 06:22:51, antes del código.

### Qué la inspiró

- **El problema** salió del análisis del 12-oct. La Fase 1 confirmó que
  seguía igual en `main`.
- **La idea de esperar más entre intentos y dejar lo agotado a la vista de
  una persona** viene de `whatsapp-saas` (MIT), que reintenta lotes de IA con
  espera de 1, 5 y 15 min y un «lote muerto».
- **El mecanismo** es el del outbox del despacho (021), que ya era nuestro:
  reclamo por `UPDATE` condicionado, reserva que vence y reanudación al
  arrancar.
- No se copió código: allá es Supabase con pg_cron y lotes del agente; aquí,
  una tabla y un temporizador dentro del proceso.

### Qué quedó

- **Tabla nueva `webhook_event`** (migración aditiva `0023`). Cada entrega de
  Meta o Zernio se guarda tal como llegó **antes** de responder 200.
  - Si no se puede guardar, la ruta responde **503** y reintenta quien mandó.
  - La misma entrega dos veces se guarda una vez (huella SHA-256).
- **Las cuatro rutas** (WhatsApp, Instagram, Messenger y TikTok) pasan por
  `recibirEvento`. Una prueba vigila que ninguna vuelva a usar `after()`
  directo.
- **Reintento** a los 30 s, 2 min, 10 min, 1 h y 6 h. Al sexto intento el
  evento queda agotado.
  - El barrido corre siempre: no depende del cerebro ni de una bandera.
  - Al arrancar, retoma lo que un reinicio dejó a medias.
- **Ajustes → WhatsApp** gana la tarjeta «Entregas»:
  - «Entregas al día», o cuántas no entraron, con su error y **Reintentar**;
  - solo la ve quien configura.
- **`/api/health`** gana la llave `webhooks: { pendientes, agotados }`.
- **Retención**: los procesados se borran a los 7 días y los agotados a los
  30, porque el cuerpo trae datos del cliente.
- **`scripts/screenshots.mjs`** ahora captura pantallas sueltas
  (`SCREENSHOTS_ONLY`), en claro u oscuro (`SCREENSHOTS_THEME`) y hasta el
  final del panel (`SCREENSHOTS_SCROLL`). Sirve para el antes y el después de
  las specs 048 a 052.

### Cómo se probó

| Qué | Resultado | Hora |
|---|---|---|
| Unitarias nuevas (`webhook-eventos`) | 14/14 | 06:27 |
| Arnés `e2e-webhook-fallos.mjs` (mocks, Playwright, claro y oscuro) | 32/32 a la primera | 06:30:36 |
| Typecheck, lint, test, build | verdes; 1 278 unitarias con banderas apagadas y con `CHANNELS` + `AGENDA` | 06:36–06:38:44 |
| Self-test general `e2e-selftest.mjs` en base limpia | 280/280 | 06:39:23–06:42:52 |
| Regresión de canales: `e2e-ventana-social` y `e2e-messenger` | 58/58 y 42/42 | ~06:43 |

En el log del servidor se ven los seis intentos reales del caso agotado, con
unos 370 ms entre uno y otro gracias a `WEBHOOK_RETRY_FAST`, y el aviso de
siempre para el número ajeno.

Lo que el arnés no cubre, dicho en el guion:

- la base caída que provoca el 503 (lo prueba la unitaria);
- la limpieza a los 7 y 30 días.

### Antes y después

En `docs/bitacora-2.2/`:

- `047-antes-ajustes-whatsapp-{light,dark}.png`: la rama 046 corriendo en un
  worktree contra la misma base. La página termina en «Webhook de WhatsApp».
- `047-despues-ajustes-whatsapp-{light,dark}.png`: aparece «Entregas al día».
- `047-agotado-{light,dark}.png`: la tarjeta con una entrega agotada y el
  botón Reintentar.

Comparación de píxeles (umbral 8 por canal), hecha en local con `scripts/comparar-capturas.mjs` (nuevo, usa el `sharp` de Next)
porque el MCP de REA no conectó en esta sesión:

| Tema | Píxeles que cambian | Delta medio por canal (R, G, B) | Filas |
|---|---|---|---|
| Claro | 12,75 % | 6,46 · 5,87 · 5,75 | 59–855 |
| Oscuro | 12,95 % | 7,74 · 7,24 · 8,58 | 59–855 |

El encabezado (filas 0–58) y la barra lateral no cambian. El resto se movió
hacia arriba para dejar sitio a la tarjeta nueva.

### Lo que salió mal

1. **El tema oscuro no se fuerza con `colorScheme`**: la preferencia es una
   cookie (`vocero-theme`). La primera captura «oscura» salió clara; se
   arregló poniendo la cookie, y así quedó en el arnés y en
   `screenshots.mjs`.
2. **Git Bash convierte `/settings/whatsapp`** de una variable de entorno en
   `C:/Program Files/Git/settings/whatsapp`. Se resolvió con
   `MSYS_NO_PATHCONV=1`.
3. **La página de Ajustes desplaza dentro de su propio panel**, y la captura
   «completa» no llegaba a la tarjeta de abajo. Se agregó
   `SCREENSHOTS_SCROLL=bottom`.
4. **El primer «antes» en claro salió en «Cargando…»** (la ruta se compilaba
   en dev). El script ahora espera a que desaparezca, y la captura se repitió.
5. **Borrar el worktree del «antes»** falló por la ruta demasiado larga del
   scratchpad. Antes de borrar a mano se quitó el enlace a `node_modules`, para
   no arrastrar el del repo. El worktree siguiente se hizo en `C:\tmp`.
6. **Typecheck en rojo** por asignar `NODE_ENV` en una prueba. Vitest ya lo
   trae en `test`: se quitó la línea.
7. **REA no conectó** al retomar la sesión (timeout de 30 s). La comparación
   de antes y después se hizo en local con las mismas métricas.

## 2026-10-23 — 048: Vocero en el celular (PWA)

**Rama**: `feat/048-pwa`, sobre la 047.
**Spec**: [`specs/048-pwa/spec.md`](../specs/048-pwa/spec.md), carril
ligero. Commiteada a las 08:50:00, antes del código. Trabajo de 08:48:50 a
09:07.

### Qué la inspiró

- **Chatwoot (MIT)**, visto con REA en la Fase 1: un `manifest.json` y un
  service worker de 35 líneas que no guarda nada.
- **DeskcommCRM (MIT)**: `app/manifest.ts` de Next.
- No se copió código de ninguno de los dos. El patrón de Next es el estándar,
  y aquí el manifest y los iconos salen de la marca de cada organización.

### Qué quedó

- **El manifest** (`src/app/manifest.ts`) se arma con la marca: nombre,
  nombre corto de ≤ 12 caracteres y el azul de la barra lateral como color de
  la app. Ningún «Vocero» cableado.
- **Iconos PNG de 180, 192 y 512**, con versión `maskable`, en
  `/api/branding/app-icon`. Los dibuja `ImageResponse` de `next/og`, que ya
  viene con Next y trae su fuente: sin dependencias nuevas.
  - Con logo subido (PNG, JPEG o SVG) va el logo.
  - Sin logo va la V de Vocero o la inicial.
- **Un service worker** (`public/sw.js`) que solo contesta «Sin conexión» a una
  navegación sin red. No guarda nada: ni páginas ni datos de clientes.
- **«Instalar app»** encima de Ajustes, solo cuando el navegador lo ofrece.
- **iPhone**: `apple-touch-icon`, `apple-mobile-web-app-capable` y una barra
  de estado negra.
- **README**: la sección «📱 En el celular, como una app».

### Cómo se probó

| Qué | Resultado | Hora |
|---|---|---|
| Unitarias nuevas (`pwa`), con PNG reales dibujados | 12/12 | 08:52:57 |
| Arnés `e2e-pwa.mjs` (perfil persistente de Chromium, CDP) | 35/35 a la primera; 36/36 tras arreglar la restauración de la marca | 08:54–08:56 |
| Typecheck, lint, test, build | verdes; 1 290 unitarias con banderas apagadas y encendidas | 08:57:18–08:58:36 |
| `next start` (producción) | icono, manifest y service worker en 200 | 08:58 |
| Imagen Docker construida de la rama (`docker build`, 1 min 38 s) | icono 512 y 180, manifest y `sw.js` en 200 desde el contenedor | 08:58:56–09:00:40 |
| Self-test general en base limpia | 280/280 | 09:01:11–09:04 |
| `e2e-favicon` (comparte la marca y el `<head>`) | 21/21 | 09:04:24 |
| `e2e-responsive` | 1 fallo **ajeno a la 048** (ver abajo) | 09:06:36 |

**Chromium la da por instalable**: `Page.getInstallabilityErrors` sale vacío
y `Page.getAppManifest` no da errores. Es lo más cerca de «instalar» que se
puede llegar sin un teléfono: el diálogo nativo no se puede pulsar desde un
script, así que el arnés simula `beforeinstallprompt`.

### Antes y después

En `docs/bitacora-2.2/`:

- **Sin conexión, antes y después**
  (`048-{antes,despues}-sin-conexion-{light,dark}.png`, 390×760).
  - Antes no había service worker y la navegación caía en la página de error
    del navegador. Chromium sin interfaz la pinta en blanco: la captura del
    antes es una pantalla vacía (la misma huella en claro y en oscuro).
  - Después aparece «Sin conexión» con **Reintentar**.
  - `comparar-capturas`: cambia el 3,38 % en claro (el texto y el botón sobre
    el mismo fondo blanco) y el 99,96 % en oscuro (todo el fondo).
- **El menú** (`048-despues-boton-instalar-{light,dark}.png`): la fila
  «Instalar app» encima de Ajustes.
- **Los iconos** (`048-icono-*.png`): la V de Vocero en 512 normal y
  maskable, y la inicial de «Taller Ruiz» sobre su verde.

### Lo que salió mal

1. **La inicial del icono salía delgada**: la fuente de `next/og` es solo la
   regular. Se engruesa con sombras del mismo color en ocho direcciones.
2. **El botón «Instalar» como icono apretaba el pie del menú**: el nombre
   quedaba en «Du…» y el rol en «Pro…». Se movió a una fila propia encima de
   Ajustes (la spec lo anota en D5).
3. **El «Reintentar» de la página sin conexión no pasaba AA en oscuro**:
   blanco sobre `#6f9eff`, alrededor de 2,6:1. Ahora es `#0d5bff` en los dos
   temas (5,3:1).
4. **El arnés no devolvía la marca a como estaba**: la API la envuelve en
   `{ branding }` y el PUT salía inválido. Se arregló y se agregó un check.
5. **En Windows no se genera el standalone** (`next.config.ts`), así que no
   se podía ver si el wasm de `next/og` viaja en la imagen. Se construyó la
   imagen Docker de la rama y se le pidió el icono al contenedor.
6. **`e2e-responsive` tiene un fallo que no es de esta spec**: «Agente
   encendido: un clic lo cambia». El servidor responde `409 sin_cerebro`
   porque ese guion no levanta el cerebro de prueba. Desde la 036, encender el
   agente exige un cerebro sano. El guion quedó atrás de la 2.0: anotado como
   pendiente aparte.
