# Tasks: Respuestas rápidas con «/»

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

- [ ] T001 `quickReply` en `schema.ts`, prefijo `qr` en `ids.ts`, `pnpm db:generate` → `0024`
- [ ] T002 `src/lib/respuestas-rapidas.ts` (puro): normalizar, token, filtrar, aplicar, rellenar
- [ ] T003 `src/server/quick-replies.ts` + rutas `GET`/`POST /api/quick-replies` y `PATCH`/`DELETE /api/quick-replies/[id]`
- [ ] T004 Menú `quick-reply-menu.tsx` y su integración en `composer.tsx`
- [ ] T005 Ajustes → Respuestas rápidas (página + cliente) y entrada en `nav.ts`
- [ ] T006 Semilla demo con cuatro respuestas, idempotente
- [ ] T007 `tests/unit/respuestas-rapidas.test.ts`
- [ ] T008 `tests/e2e/us-respuestas-rapidas.md` + `scripts/e2e-respuestas-rapidas.mjs`
- [ ] T009 Gates en las dos configuraciones, self-test general, capturas de antes y después en claro y oscuro
- [ ] T010 AGENTS.md, `specs/README.md`, bitácora y PR
