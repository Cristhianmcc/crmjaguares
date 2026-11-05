import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { computeAvailability } from "@/server/agenda/availability";
import { getSettings } from "@/server/agenda/settings";
import { spreadByDay, type SpreadSlot } from "@/server/agenda/spread";
import { clearOffers, replaceOffers } from "@/server/agenda/offers";
import {
  BookingError,
  cancelBooking,
  createSessionBooking,
} from "@/server/agenda/service";
import {
  addDaysISO,
  dayIsoInTz,
  dayLabelInTz,
  timeInTz,
  todayInTz,
  zonedWallClockToUtc,
} from "@/lib/time/slots";

/**
 * 015 — Lo que el agente incluido puede hacer con la agenda.
 */

const OFFERED = 24;

export type AgendaTurn = {
  /** Lo que hay que enviarle al cliente. */
  text: string;
  /** false ⇒ el motor no pudo; el turno sigue, sin agendar. */
  ok: boolean;
};

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Resuelve una fecha a partir del texto en lenguaje natural en español
 * (ej: "viernes", "el lunes", "mañana", "el 6 de noviembre").
 */
export function resolveRequestedDate(
  text: string,
  timezone: string,
  now: Date = new Date()
): string | null {
  const t = text.toLowerCase().trim();
  const hoyIso = todayInTz(now, timezone);

  if (/\bhoy\b/.test(t)) return hoyIso;
  if (/\bpasado\s+mañana\b|\bpasado\s+manana\b/.test(t)) {
    return addDaysISO(hoyIso, 2);
  }
  if (
    /\bmañana\b|\bmanana\b/.test(t) &&
    !/\b(en|por)\s+la\s+mañana\b|\b(en|por)\s+la\s+manana\b/.test(t)
  ) {
    return addDaysISO(hoyIso, 1);
  }

  const diasSemana: { key: string; weekdayIndex: number }[] = [
    { key: "domingo", weekdayIndex: 0 },
    { key: "lunes", weekdayIndex: 1 },
    { key: "martes", weekdayIndex: 2 },
    { key: "miercoles", weekdayIndex: 3 },
    { key: "miércoles", weekdayIndex: 3 },
    { key: "jueves", weekdayIndex: 4 },
    { key: "viernes", weekdayIndex: 5 },
    { key: "sabado", weekdayIndex: 6 },
    { key: "sábado", weekdayIndex: 6 },
  ];

  for (const d of diasSemana) {
    if (new RegExp(`\\b${d.key}\\b`).test(t)) {
      const noon = zonedWallClockToUtc(hoyIso, "12:00", timezone) ?? now;
      const currentDayOfWeek = noon.getUTCDay();
      let diff = d.weekdayIndex - currentDayOfWeek;
      if (diff <= 0) diff += 7;
      return addDaysISO(hoyIso, diff);
    }
  }

  const isoMatch = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (isoMatch) return isoMatch[0];

  const meses: Record<string, number> = {
    enero: 1, ene: 1,
    febrero: 2, feb: 2,
    marzo: 3, mar: 3,
    abril: 4, abr: 4,
    mayo: 5, may: 5,
    junio: 6, jun: 6,
    julio: 7, jul: 7,
    agosto: 8, ago: 8,
    septiembre: 9, setiembre: 9, sep: 9, set: 9,
    octubre: 10, oct: 10,
    noviembre: 11, nov: 11,
    diciembre: 12, dic: 12,
  };

  const regexMes =
    /(\d{1,2})\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)\b/;
  const matchMes = regexMes.exec(t);
  if (matchMes && matchMes[1] && matchMes[2]) {
    const day = parseInt(matchMes[1], 10);
    const month = meses[matchMes[2]];
    if (month && day >= 1 && day <= 31) {
      const year = now.getFullYear();
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
  }

  return null;
}

function buildMultiDayLines(
  spread: SpreadSlot[],
  shift?: "morning" | "afternoon"
): string {
  const byDay = new Map<
    string,
    { dayLabel: string; mornings: string[]; afternoons: string[] }
  >();

  for (const s of spread) {
    let entry = byDay.get(s.dayIso);
    if (!entry) {
      entry = { dayLabel: s.dayLabel, mornings: [], afternoons: [] };
      byDay.set(s.dayIso, entry);
    }
    if (s.time < "12:00") {
      if (entry.mornings.length < 3) entry.mornings.push(s.time);
    } else {
      if (entry.afternoons.length < 3) entry.afternoons.push(s.time);
    }
  }

  const dayEntries = Array.from(byDay.entries()).slice(0, 3);
  return dayEntries
    .map(([, data]) => {
      const parts: string[] = [];
      if (shift === "afternoon") {
        parts.push(data.afternoons.join("   •   "));
      } else if (shift === "morning") {
        parts.push(data.mornings.join("   •   "));
      } else {
        if (data.mornings.length > 0) {
          parts.push(`${data.mornings.join(", ")} (Mañana)`);
        }
        if (data.afternoons.length > 0) {
          parts.push(`${data.afternoons.join(", ")} (Tarde)`);
        }
      }
      return `• *${capitalizeFirst(data.dayLabel)}:*\n   ${parts.join("  ·  ")}`;
    })
    .join("\n\n");
}

export async function offerSlots(input: {
  organizationId: string;
  conversationId: string;
  intro?: string;
  date?: string;
  shiftPreference?: "morning" | "afternoon";
}): Promise<AgendaTurn> {
  const settings = await getSettings(input.organizationId);
  const now = new Date();
  const tz = settings.timezone;

  // 1. Consulta para una fecha específica
  if (input.date) {
    const requestedDate = input.date;
    const daySlotsAll = await computeAvailability(input.organizationId, {
      settings,
      now,
      fromISO: requestedDate,
      toISO: requestedDate,
    });

    const shift = input.shiftPreference;
    let daySlots = daySlotsAll;
    if (shift === "morning") {
      daySlots = daySlotsAll.filter((s) => timeInTz(s.startUtc, tz) < "12:00");
    } else if (shift === "afternoon") {
      daySlots = daySlotsAll.filter((s) => timeInTz(s.startUtc, tz) >= "12:00");
    }

    if (daySlots.length > 0) {
      await replaceOffers(
        input.organizationId,
        input.conversationId,
        daySlots.map((s) => ({ startUtc: s.startUtc, label: s.label }))
      );

      const firstSlot = daySlots[0];
      const dayLabel = firstSlot ? capitalizeFirst(dayLabelInTz(firstSlot.startUtc, tz, now)) : requestedDate;
      const mornings = daySlots.filter((s) => timeInTz(s.startUtc, tz) < "12:00");
      const afternoons = daySlots.filter((s) => timeInTz(s.startUtc, tz) >= "12:00");

      const sections: string[] = [];
      if (mornings.length > 0) {
        sections.push(
          `☀️ *Turno Mañana:*\n${mornings.map((s) => `• ${timeInTz(s.startUtc, tz)}`).join("   ")}`
        );
      }
      if (afternoons.length > 0) {
        sections.push(
          `🌤️ *Turno Tarde:*\n${afternoons.map((s) => `• ${timeInTz(s.startUtc, tz)}`).join("   ")}`
        );
      }

      const card = [
        `📅 *HORARIOS DISPONIBLES — ${dayLabel}*`,
        "━━━━━━━━━━━━━━━━━━━━━━",
        ...sections,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "¿Cuál de estos horarios te acomoda mejor?",
      ].join("\n");

      return { ok: true, text: card };
    }

    // Si ese día no tiene turnos, buscar alternativas en días cercanos
    const allUpcoming = await computeAvailability(input.organizationId, {
      settings,
      now,
    });
    const spreadUpcoming = spreadByDay(allUpcoming, {
      timezone: tz,
      limit: OFFERED,
      perDay: 3,
      now,
      shift,
    });

    if (spreadUpcoming.length > 0) {
      await replaceOffers(
        input.organizationId,
        input.conversationId,
        spreadUpcoming.map((s) => ({ startUtc: s.startUtc, label: s.label }))
      );

      const alternatives = buildMultiDayLines(spreadUpcoming, shift);
      const card = [
        `📅 *FECHA SOLICITADA (${requestedDate})*`,
        "━━━━━━━━━━━━━━━━━━━━━━",
        shift === "afternoon"
          ? "Por ahora no contamos con turnos disponibles por la tarde para esta fecha."
          : "Por el momento no contamos con turnos disponibles para esta fecha.",
        "",
        "Aquí tienes las fechas más próximas con horarios disponibles:",
        alternatives,
        "━━━━━━━━━━━━━━━━━━━━━━",
        "¿Te gustaría agendar en alguna de estas opciones?",
      ].join("\n");

      return { ok: true, text: card };
    }
  }

  // 2. Consulta general multi-día
  const all = await computeAvailability(input.organizationId, {
    settings,
    now,
  });

  const shift = input.shiftPreference;
  let spread = spreadByDay(all, {
    timezone: settings.timezone,
    limit: OFFERED,
    perDay: 3,
    now,
    shift,
  });

  let shiftFallback = false;
  if (spread.length === 0 && shift) {
    spread = spreadByDay(all, {
      timezone: settings.timezone,
      limit: OFFERED,
      perDay: 3,
      now,
    });
    if (spread.length > 0) {
      shiftFallback = true;
    }
  }

  if (spread.length === 0) {
    return {
      ok: false,
      text:
        input.intro?.trim() ||
        "Por ahora no me quedan horarios libres en los próximos días. Déjame confirmarlo con el equipo y te aviso.",
    };
  }

  await replaceOffers(
    input.organizationId,
    input.conversationId,
    spread.map((s) => ({ startUtc: s.startUtc, label: s.label }))
  );

  const lines = buildMultiDayLines(spread, shiftFallback ? undefined : shift);

  let headerTitle = "PRÓXIMOS TURNOS DISPONIBLES";
  if (!shiftFallback && shift === "afternoon") {
    headerTitle = "TURNOS DISPONIBLES POR LA TARDE";
  } else if (!shiftFallback && shift === "morning") {
    headerTitle = "TURNOS DISPONIBLES POR LA MAÑANA";
  }

  const card = [
    `📅 *${headerTitle}:*`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    lines,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "Dime qué día y horario prefieres, o si buscas una fecha específica indícanosla para ver todos sus horarios.",
  ].join("\n");

  return { ok: true, text: card };
}

export async function bookSlot(input: {
  organizationId: string;
  conversationId: string;
  startUtc: string;
  patientName?: string;
  dni?: string;
  serviceOrReason?: string;
  notes?: string;
  confirmation?: string;
}): Promise<AgendaTurn> {
  try {
    const result = await createSessionBooking({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      startUtc: input.startUtc,
      source: "ai",
      requireOffer: true,
      patientName: input.patientName,
      dni: input.dni,
      serviceOrReason: input.serviceOrReason,
      notes: input.notes,
    });

    let base = input.confirmation?.trim();
    if (!base) {
      const cardLines = [
        `¡Listo! 🎉 Tu cita quedó confirmada con éxito:`,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `📅 *Fecha:* ${result.label}`,
        input.patientName ? `👤 *Paciente:* ${input.patientName}` : null,
        input.dni ? `🆔 *DNI:* ${input.dni}` : null,
        input.serviceOrReason ? `🩺 *Motivo:* ${input.serviceOrReason}` : null,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `Le pedimos llegar 10 minutos antes. Si necesita reprogramar, avísenos con al menos 2 horas de anticipación. ¡Muchas gracias!`,
      ].filter(Boolean);
      base = cardLines.join("\n");
    }

    if (result.meetingLink) {
      return { ok: true, text: `${base}\nEnlace: ${result.meetingLink}` };
    }
    if (result.linkPending) {
      return {
        ok: true,
        text: `${base}\nEn un momento te comparto el enlace por aquí.`,
      };
    }
    return { ok: true, text: base };
  } catch (err) {
    if (!(err instanceof BookingError)) throw err;

    if (err.slots.length > 0) {
      const lista = err.slots
        .slice(0, 3)
        .map((s) => `• ${s.label}`)
        .join("\n");
      const disculpa =
        err.code === "slot_taken"
          ? "Se me acaba de ocupar ese horario, ¡perdón!"
          : "Déjame confirmarte los horarios que tengo:";
      return { ok: false, text: `${disculpa}\n${lista}` };
    }
    return {
      ok: false,
      text: "No pude agendarlo en este momento. Lo reviso con el equipo y te confirmo.",
    };
  }
}

/**
 * Cancela la cita activa del contacto registrando el motivo en el sistema.
 */
export async function cancelSlot(input: {
  organizationId: string;
  conversationId: string;
  reason?: string;
  confirmation?: string;
}): Promise<AgendaTurn> {
  const db = getDb();
  const convRows = await db
    .select({ contactId: schema.conversation.contactId })
    .from(schema.conversation)
    .where(
      scoped(
        schema.conversation.organizationId,
        input.organizationId,
        eq(schema.conversation.id, input.conversationId)
      )
    )
    .limit(1);

  const contactId = convRows[0]?.contactId;
  if (!contactId) {
    return {
      ok: false,
      text:
        input.confirmation?.trim() ||
        "No se encontró ninguna cita registrada para cancelar.",
    };
  }

  const bookings = await db
    .select()
    .from(schema.booking)
    .where(
      scoped(
        schema.booking.organizationId,
        input.organizationId,
        and(
          eq(schema.booking.contactId, contactId),
          eq(schema.booking.kind, "session"),
          eq(schema.booking.status, "agendada")
        )
      )
    )
    .orderBy(asc(schema.booking.scheduledAt))
    .limit(1);

  const target = bookings[0];
  if (!target) {
    return {
      ok: false,
      text:
        input.confirmation?.trim() ||
        "No tienes ninguna cita activa agendada en este momento. Si deseas programar una nueva cita, dime y con gusto te muestro los horarios disponibles.",
    };
  }

  await cancelBooking({
    organizationId: input.organizationId,
    bookingId: target.id,
    reason: input.reason,
  });
  await clearOffers(input.organizationId, input.conversationId).catch(() => {});

  let base = input.confirmation?.trim();
  if (!base) {
    if (input.reason?.trim()) {
      base = `Listo, tu cita ha sido cancelada. Registramos el motivo: *${input.reason.trim()}*.\n\n¿Te gustaría que la reprogramemos para otra fecha u horario?`;
    } else {
      base = "Listo, tu cita ha sido cancelada exitosamente. ¿Te gustaría reagendar para otro día u horario?";
    }
  }

  return { ok: true, text: base };
}
