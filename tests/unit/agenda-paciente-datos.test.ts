import { describe, expect, it } from "vitest";
import { agentActionSchema } from "@/server/ai/actions";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";
import { RUBRO_PRESETS } from "@/lib/rubro-presets";

describe("Protocolo de captura de datos del paciente para agendamiento", () => {
  it("el esquema de acciones acepta book_slot con patientName, dni y serviceOrReason", () => {
    const schema = agentActionSchema(true);
    const parsed = schema.safeParse({
      action: "book_slot",
      startUtc: "2026-11-11T18:30:00.000Z",
      patientName: "Cristhian Medina Carrasco",
      dni: "72481920",
      serviceOrReason: "Limpieza y profilaxis",
      reply: "¡Listo, Cristhian! Tu cita quedó confirmada.",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.action === "book_slot") {
      expect(parsed.data.patientName).toBe("Cristhian Medina Carrasco");
      expect(parsed.data.dni).toBe("72481920");
      expect(parsed.data.serviceOrReason).toBe("Limpieza y profilaxis");
    }
  });

  it("book_slot mantiene compatibilidad si los campos son omitidos", () => {
    const schema = agentActionSchema(true);
    const parsed = schema.safeParse({
      action: "book_slot",
      startUtc: "2026-11-11T18:30:00.000Z",
    });

    expect(parsed.success).toBe(true);
  });

  it("el system prompt incluye el protocolo obligatorio de captura de datos antes de confirmar", () => {
    const prompt = buildAgentSystemPrompt({
      profile: {
        organizationId: "org_1",
        name: "Muelita",
        tone: "cálido",
        instructions: "Atiende pacientes",
        escalationRules: "Pasa a humano",
        tools: ["ficha", "agendar"],
        updatedAt: new Date(),
      },
      kb: [],
      stages: [{ name: "Nuevo" }],
      agenda: true,
      rubro: "dental",
      businessName: "Dulcident",
    });

    expect(prompt).toContain("PROTOCOLO OBLIGATORIO DE REGISTRO DE DATOS ANTES DE AGENDAR");
    expect(prompt).toContain("Nombre y Apellidos completos del paciente");
    expect(prompt).toContain("DNI o Documento de Identidad");
    expect(prompt).toContain("Motivo de la consulta o tratamiento");
    expect(prompt).toContain("patientName");
    expect(prompt).toContain("dni");
  });

  it("la plantilla predefinida de clínica dental exige pedir datos para la historia clínica", () => {
    const dental = RUBRO_PRESETS.dental;
    expect(dental.instructions).toContain("historia clínica");
    expect(dental.instructions).toContain("Nombres y Apellidos completos");
    expect(dental.instructions).toContain("DNI");
    expect(dental.instructions).toContain("patientName");
  });
});
