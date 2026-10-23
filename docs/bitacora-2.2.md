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
