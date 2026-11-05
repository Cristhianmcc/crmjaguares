# Resumen Ejecutivo de Avances — CRM Vocero (Jaguares / Monterrial)

**Fecha:** 5 de noviembre de 2026  
**Versión:** v2.5.2  
**Repositorio:** `Cristhianmcc/crmjaguares` (Rama `main`)  
**URL de Producción:** `https://crm.jaguarescar.com`

---

## 1. Arquitectura Multi-Empresa y Plantillas por Rubro

El CRM opera bajo una arquitectura **multi-tenant**, permitiendo aislar organizaciones con su propia configuración, agenda, base de conocimiento y agente de IA.

### Plantillas Predefinidas y Auto-Siembra
- **Rubros Soportados:**
  - `escuela`: Escuela deportiva formativa (fútbol, vóley, baby fútbol, mamas fit). Incluye conexión en vivo con catálogo de cupos y menú nativo desplegable de WhatsApp.
  - `dental`: Clínica odontológica / consultorio dental (curaciones, profilaxis, ortodoncia, endodoncia, blanqueamiento).
  - `servicios`: Consultoría, servicios profesionales y comercios generales.
- **Auto-Siembra (`auto-seed`):**
  Al registrar una nueva empresa o seleccionar un rubro en la vista de Agente, se inicializa automáticamente:
  - Nombre y personalidad del agente (ej. *"Muelita"* para Dental, *"Asistente Jaguares"* para Escuela).
  - Base de conocimiento completa (servicios, tarifas de referencia, ubicación, formas de pago y políticas).
  - Preguntas y respuestas frecuentes (Q&A).
  - Reglas de comportamiento, instrucciones duras y reglas de escalado a humanos.
  - Etapas personalizadas del embudo de ventas.

---

## 2. Asistente de IA y Motor de Agenda

### A. Cancelación Automática de Citas (`cancel_slot`)
- **Problema previo:** Si el cliente solicitaba cancelar (*"Quiero cancelar esa cita"*), el sistema forzaba un `handoff` a un asesor humano.
- **Mejora:**
  - Se agregó la acción tipada `cancel_slot` al esquema del agente en `src/server/ai/actions.ts`.
  - El motor localiza la cita activa del contacto en la base de datos, la marca como `"cancelada"` y libera el cupo.
  - El bot confirma la cancelación con amabilidad e invita a reagendar sin transferir a un asesor.
  - Se inyecta el estado de la cita activa en el prompt del sistema (`src/server/ai/pipeline.ts`) para que la IA conozca en todo momento la fecha y hora de la cita del cliente.

### B. Soporte de Turnos por la Tarde y Preferencia de Horario
- **Problema previo:** El sistema solo seleccionaba los primeros 3 huecos del día (ej. `09:00`, `09:30`, `10:00`). Al preguntar *"¿Y por la tarde?"*, el bot indicaba no tener turnos disponibles.
- **Mejora:**
  - Soporte de filtro por turno (`shiftPreference: "morning" | "afternoon"`) en `src/server/agenda/agent.ts` y `src/server/agenda/spread.ts`.
  - Reconocimiento automático en lenguaje natural de solicitudes como *"tarde"*, *"en la tarde"*, *"pm"* o *"después de almuerzo"*, entregando turnos a partir de las 12:00.
  - Ampliación del catálogo reservable a **24 turnos** distribuidos en varios días para ofrecer variedad de fechas (jueves, viernes, lunes, etc.).

---

## 3. Mejoras de Interfaz de Usuario (UI/UX)

1. **Reemplazo de Alerts de Navegador por Modales:**
   - Se crearon componentes accesibles (`PresetConfirmDialog` y `RoleConfirmDialog`) con diseño oscuro moderno y botones de confirmación elegantes, eliminando los diálogos nativos `window.confirm()` y `alert()`.
2. **Edición en Línea de Conocimiento Base:**
   - Botón de edición tipo lápiz para bloques de texto libre y pares de preguntas/respuestas en la vista de configuración del agente, permitiendo modificar datos sin tener que eliminarlos y recrearlos.
3. **Vocabulario Empresarial:**
   - Reemplazo del término técnico *"huecos"* por *"turnos disponibles para el bot"*.
4. **Previsualización de Turnos con Etiquetas de Mañana y Tarde:**
   - En Ajustes → Agenda se visualizan hasta 18 turnos en tiempo real diferenciados con distintivos visuales (`Mañana` en azul, `Tarde` en ámbar).

---

## 4. Sincronización con Calendarios Externos

1. **Feed iCalendar (`.ics` / WebCal):**
   - Endpoint activo en `/api/calendar/feed` para suscribirse desde iPhone, iPad, Mac y Google Calendar.
   - Eliminada la exclusión de citas de prueba para garantizar visibilidad total.
   - Encabezados `no-cache`, `must-revalidate` y propiedad `TRANSP:OPAQUE`.
2. **Descarga Directa `.ics`:**
   - Botón *"Descargar archivo .ics"* en la vista de Citas para importar eventos de forma instantánea en Google Calendar sin esperar el intervalo de rastreo del servidor de Google (8–24 h).

---

## 5. Historial de Commits Clave

| Commit | Descripción |
|---|---|
| `5153126` | `feat(agenda): cancelacion automatica sin escalacion humana y soporte de turnos por la tarde` |
| `0e33e4e` | `feat(agenda): soporte de variedad multifecha en turnos del bot y vista ampliada de agenda` |
| `a380610` | `feat: edicion en linea de base de conocimiento, exportacion completa de citas a calendario y mejoras de texto` |
| `f6c52f8` | `feat(ui): reemplazar alert de navegador por modal dialog estilizado y accesible en la carga de plantillas` |
| `0c95bda` | `feat(presets): plantillas predefinidas por rubro con auto-siembra para cuentas nuevas y selector en agente` |

---

## 6. Verificación y Estado del Sistema

- **Compilación TypeScript:** `npx tsc --noEmit` completado con **0 errores**.
- **Pruebas Unitarias:** 43 de 43 pruebas superadas (`vitest run`).
- **Despliegue:** Integración continua activa en Dokploy mediante push automático a la rama `main`.
