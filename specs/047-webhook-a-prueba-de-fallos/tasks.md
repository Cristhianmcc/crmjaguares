# Tasks: Webhook a prueba de fallos

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

## Fase 1 — Datos

- [ ] T001 `webhookEvent` en `src/lib/db/schema.ts`; prefijo `whe` en `src/lib/db/ids.ts`
- [ ] T002 `pnpm db:generate` → `drizzle/0023_webhook_event.sql`; revisar que sea solo aditiva

## Fase 2 — Núcleo (`src/server/webhooks/`)

- [ ] T003 `eventos.ts`: huella, `guardarEvento`, `tomarEvento`, `tomarPendientes`, `marcarProcesado`, `reintentarOAgotar`, `esperaDeReintento`, `reintentarAgotados`, `conteos`, `purgar`
- [ ] T004 `procesar.ts`: `procesarFuente` con los cuatro procesadores; mover ahí el `processPayload` de WhatsApp
- [ ] T005 `organizacion.ts`: `resolverOrganizacion(fuente, payload)` con los buscadores de credenciales existentes
- [ ] T006 `recibir.ts`: `recibirEvento` (guardar o caer al camino de hoy si no hay organización)
- [ ] T007 `worker.ts`: `procesarEvento`, `barrido`, `iniciarBarrido` (en `globalThis`), limpieza horaria
- [ ] T008 Fallo de prueba en `src/server/dev/` + `POST /api/dev/webhook-fallo` tras `dev-guard`
- [ ] T009 `instrumentation-node.ts` arranca el barrido

## Fase 3 — Rutas

- [ ] T010 `/api/webhooks/wa`: guardar, 503 si no se puede, `after(procesarEvento)`
- [ ] T011 `/api/webhooks/ig`, `messenger`, `tiktok`: lo mismo, con la fuente según Meta o Zernio

## Fase 4 — Visibilidad

- [ ] T012 `GET`/`POST /api/settings/webhook/eventos` (`canConfigure`, `scoped()`)
- [ ] T013 Tarjeta «Entregas» en `whatsapp-wizard.tsx`
- [ ] T014 `webhooks` en `/api/health` (`src/server/health.ts`) y su prueba

## Fase 5 — Pruebas y documentación

- [ ] T015 `tests/unit/webhook-eventos.test.ts` (espera, huella, resolución, recibir, guardarraíl de rutas)
- [ ] T016 `tests/e2e/us-webhook-fallos.md` + `scripts/e2e-webhook-fallos.mjs`
- [ ] T017 Enmendar `specs/001-vocero-core/contracts/webhook.md` y AGENTS.md (webhooks de entrada, `/api/health`, mapa de `src/server/`)
- [ ] T018 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (banderas apagadas y `CHANNELS` + `AGENDA`)
- [ ] T019 Self-test en vivo con mocks (arnés + Playwright en la tarjeta), capturas en claro y oscuro
- [ ] T020 Bitácora 2.2 y PR contra `main` (sobre #146)
