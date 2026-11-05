import { createHmac } from "node:crypto";
import { and, eq, inArray, gte, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";

export function getCalendarFeedToken(orgId: string): string {
  const secret = getEnv().BETTER_AUTH_SECRET || "monterrial_calendar_secret_key_2026";
  return createHmac("sha256", secret)
    .update(`calendar-feed-v1:${orgId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyCalendarFeedToken(orgId: string, token: string): boolean {
  if (!orgId || !token) return false;
  const expected = getCalendarFeedToken(orgId);
  return expected.toLowerCase() === token.toLowerCase();
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function buildIcsFeed(orgId: string): Promise<string> {
  const db = getDb();

  // Nombre de la organización
  const orgRows = await db
    .select({ name: schema.organization.name })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  const orgName = orgRows[0]?.name || "Monterrial CRM";

  // Citas desde hace 15 días hasta 90 días en el futuro
  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

  const bookings = await db
    .select({
      id: schema.booking.id,
      scheduledAt: schema.booking.scheduledAt,
      durationMinutes: schema.booking.durationMinutes,
      status: schema.booking.status,
      kind: schema.booking.kind,
      meetingLink: schema.booking.meetingLink,
      notes: schema.booking.notes,
      contactName: schema.contact.name,
      contactPhone: schema.contact.phone,
    })
    .from(schema.booking)
    .leftJoin(schema.contact, eq(schema.booking.contactId, schema.contact.id))
    .where(
      and(
        eq(schema.booking.organizationId, orgId),
        inArray(schema.booking.status, ["agendada", "realizada"]),
        gte(schema.booking.scheduledAt, since)
      )
    )
    .orderBy(desc(schema.booking.scheduledAt));

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Monterrial CRM//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(`Citas - ${orgName}`)}`,
    "X-WR-TIMEZONE:America/Lima",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const b of bookings) {
    const duration = b.durationMinutes && b.durationMinutes > 0 ? b.durationMinutes : 30;
    const start = b.scheduledAt;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const title =
      b.kind === "block"
        ? "Horario Bloqueado"
        : `Cita: ${b.contactName || "Paciente / Cliente"}`;

    const descLines: string[] = [];
    if (b.contactName) descLines.push(`Paciente / Contacto: ${b.contactName}`);
    if (b.contactPhone) descLines.push(`WhatsApp: ${b.contactPhone}`);
    if (b.notes) descLines.push(`Detalles / Motivo: ${b.notes}`);
    if (b.meetingLink) descLines.push(`Ubicación / Link: ${b.meetingLink}`);
    descLines.push("Agendado automáticamente por Asistente de IA");
    descLines.push("Monterrial CRM");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:booking-${b.id}@crm.jaguarescar.com`);
    lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
    lines.push(`DTSTART:${formatIcalDate(start)}`);
    lines.push(`DTEND:${formatIcalDate(end)}`);
    lines.push(`SUMMARY:${escapeIcalText(title)}`);
    lines.push(`DESCRIPTION:${escapeIcalText(descLines.join("\n"))}`);
    if (b.meetingLink) {
      lines.push(`LOCATION:${escapeIcalText(b.meetingLink)}`);
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("SEQUENCE:0");

    // Alarma 30 minutos antes para iPhone y Android
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeIcalText(`Recordatorio: ${title}`)}`);
    lines.push("TRIGGER:-PT30M");
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}
