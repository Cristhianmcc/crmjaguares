/**
 * 015 — Si esta instancia o la organización tiene agenda o no.
 *
 * En SaaS Multi-tenant, cada organización puede pertenecer a un rubro distinto:
 * - "servicios" (dental, salud, consultorios, etc.): tiene Citas, Google Calendar y agendamiento IA.
 * - "escuela" (talleres, academias deportivas): tiene Cupos en lugar de Citas.
 * - "comercio" (ventas generales): sin citas ni cupos.
 */

/** Valores que cuentan como "encendida". Cualquier otra cosa, apagada. */
const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);
const OFF_VALUES = new Set(["off", "0", "false", "no"]);

export function parseAgendaFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function agendaEnabled(orgRubro?: string | null): boolean {
  if (orgRubro !== undefined && orgRubro !== null) {
    if (orgRubro === "escuela" || orgRubro === "comercio") return false;
    return true;
  }
  const envVal = (process.env.AGENDA ?? "").trim().toLowerCase();
  if (OFF_VALUES.has(envVal)) return false;
  if (ON_VALUES.has(envVal)) return true;
  return true;
}

export function cuposEnabled(orgRubro?: string | null): boolean {
  return orgRubro === "escuela";
}

/**
 * Respuesta para una superficie de agenda apagada. 404 y no 403 a propósito:
 * si la agenda no está encendida, ese endpoint no existe en esta instancia —
 * no hay nada que revelar sobre él.
 */
export function agendaDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}
