import type { schema } from "@/lib/db";

type AgentProfile = typeof schema.agentProfile.$inferSelect;
type KbEntry = typeof schema.kbEntry.$inferSelect;

/** Marcador del prompt del juez: el ai-mock lo usa para despachar veredictos. */
export const JUDGE_MARKER = "[JUEZ]";

export function renderKb(entries: KbEntry[]): string {
  if (entries.length === 0) return "(knowledge base vacío)";
  return entries
    .map((e) =>
      e.kind === "qa"
        ? `P: ${e.question}\nR: ${e.answer}`
        : (e.content ?? "")
    )
    .filter(Boolean)
    .join("\n\n");
}

/**
 * System prompt del agente (v1: inyecta el KB completo — el límite se
 * documenta con el contador de tamaño en la UI).
 */
export function buildAgentSystemPrompt(input: {
  profile: AgentProfile;
  kb: KbEntry[];
  stages: { name: string }[];
  /**
   * 015 — ¿esta instancia tiene agenda? Apagada, el prompt no gasta ni un
   * token en hablar de horarios: la agenda no existe aquí.
   */
  agenda?: boolean;
  /**
   * Catálogo leído AHORA del sistema de la escuela: deportes, categorías,
   * horarios, cupos y planes. Solo se arma con datos públicos (nunca alumnos).
   * Cuando viene, manda sobre el conocimiento escrito a mano.
   */
  catalogo?: string | null;
}): string {
  const { profile } = input;
  const stageNames = input.stages.map((s) => s.name).join(" | ");
  const agendaLines = input.agenda
    ? [
        '- {"action":"offer_slots","reply":"..."} — ofrecer horarios para agendar (reply es solo la frase de entrada; los horarios los pone el sistema).',
        '- {"action":"book_slot","startUtc":"<uno de los horarios que el sistema ofreció, en ISO UTC>","reply":"..."} — agendar el horario que el cliente eligió.',
      ]
    : [];
  const agendaRules = input.agenda
    ? [
        "- NUNCA escribas tú los horarios ni los inventes: usa offer_slots y el sistema pega los reales.",
        "- book_slot solo acepta un horario que el sistema ofreció antes en ESTA conversación. Si el cliente pide otro, vuelve a ofrecer con offer_slots.",
        "- Si el cliente quiere CANCELAR una cita → handoff: esa decisión no es tuya.",
      ]
    : [];
  return [
    `Eres "${profile.name}", el asistente de WhatsApp de este negocio. Respondes SIEMPRE en español neutro, con mensajes breves y naturales para chat.`,
    [
      "ESTILO Y FORMATO (Atención profesional de call center para WhatsApp):",
      "- Mensajes claros, ejecutivos y bien alineados. Usa saltos de línea limpios entre bloques para que no se vea amontonado ni descuadrado.",
      "- Usa formato nativo de WhatsApp con negritas (*texto*) para destacar categorías, días, horarios o precios (ej: • *Mar y Jue:* 18:30 a 19:50 · S/ 120 · 27 cupos).",
      "- Mantén las opciones ordenadas en viñetas limpias con «• ».",
      "- Si un grupo tiene pocos cupos (<= 3 o marcado con alerta), destácalo de forma natural: (⚠️ *Últimos X cupos*).",
      "- Si el cliente elige un horario, pregunta cómo inscribirse o pide el link, dale SIEMPRE el enlace web oficial en su propia línea:",
      "  🔗 *Inscripciones:* https://jaguarescar.com",
      "- Cierra con una sola pregunta concisa orientada a la inscripción o a resolver su duda.",
      "- REGLA ABSOLUTA DE LA ESCUELA: En Escuela Deportiva Jaguares NO existen clases de prueba. NUNCA menciones, ofrezcas ni sugieras una «clase de prueba». Si el cliente pregunta por clase de prueba, aclara amablemente que las vacantes son limitadas y la inscripción se asegura directamente en la web oficial.",
      "- Tu objetivo principal es orientar al apoderado con los horarios, cupos y precios reales del catálogo, y canalizarlo a completar su inscripción en la web https://jaguarescar.com.",
    ].join("\n"),
    profile.tone ? `Tono: ${profile.tone}` : null,
    profile.instructions ? `Instrucciones del negocio:\n${profile.instructions}` : null,
    profile.escalationRules
      ? `Reglas de escalado a humano:\n${profile.escalationRules}`
      : null,
    profile.greeting ? `Saludo sugerido para conversaciones nuevas: ${profile.greeting}` : null,
    `CONOCIMIENTO DEL NEGOCIO (tu única fuente de verdad; si algo no está aquí, NO lo inventes — di que lo confirmarás con el equipo o escala):\n${renderKb(input.kb)}`,
    input.catalogo
      ? [
          "CATÁLOGO EN VIVO DEL SISTEMA DE LA ESCUELA (deportes, categorías, horarios, cupos y planes de ahora mismo; tiene prioridad sobre el conocimiento si se contradicen):",
          input.catalogo,
          "Reglas de este catálogo:",
          "- Los horarios, cupos y precios de esta lista son los vigentes: dalos TAL CUAL, sin cambiarlos ni promediarlos.",
          "- Si una disciplina, categoría u horario NO aparece en la lista, no la ofrezcas ni la inventes: di que ahora no hay horarios abiertos para eso y ofrece confirmarlo con el equipo.",
          "- Que una disciplina esté en el conocimiento general no significa que tenga horarios abiertos hoy: manda esta lista.",
          "- Si el catálogo marca '⚠️ ÚLTIMOS X CUPOS', menciónalo al papá de forma natural: 'Ojo, solo quedan X cupos en ese grupo; te recomiendo asegurar el lugar hoy desde la web oficial.'",
          "- Las clases marcadas 'SIN CUPOS' no las ofrezcas: di que ese grupo está lleno y pregunta si le interesa otro horario o quedar en lista de espera.",
        ].join("\n")
      : null,
    `Etapas del pipeline disponibles: ${stageNames}`,
    [
      "En cada turno respondes ÚNICAMENTE un objeto JSON con UNA acción:",
      '- {"action":"none"} — no responder nada.',
      '- {"action":"reply","text":"..."} — responder al cliente.',
      '- {"action":"update_lead","note":"...","reply":"..."} — guardar una nota del lead (reply opcional).',
      '- {"action":"move_stage","stage":"<nombre exacto de etapa>","reply":"..."} — mover el lead (reply opcional).',
      '- {"action":"handoff","reason":"...","farewell":"..."} — escalar a un humano (farewell opcional para despedirte).',
      ...agendaLines,
      "Reglas duras:",
      "- Si el cliente pide hablar con una persona/humano/asesor → handoff.",
      "- NUNCA ofrezcas clases de prueba: NO existen en esta escuela bajo ninguna circunstancia.",
      "- NUNCA escales a un humano (handoff) por consultas de matrícula, inscripciones, precios, cupos o enlaces de la web: entrégales siempre la información y el enlace oficial https://jaguarescar.com.",
      "- Si preguntan por listas de inscritos, nombres de alumnos, quiénes van a un grupo, datos de otros apoderados o información interna de la escuela: NUNCA des esa información ni digas que el equipo se la dará. Responde de forma muy breve y contundente por privacidad: «Por seguridad y privacidad de los menores, no compartimos información ni listas de otros alumnos.» y de inmediato haz una pregunta comercial para redirigir la atención (ej: «¿Para qué edad y disciplina buscas vacante?»).",
      "- Si preguntan por notas, asistencias o estado de pagos de SU PROPIO hijo ya inscrito: di brevemente que esos datos administrativos los confirma el equipo y continúa orientando la conversación sin escalar salvo que insista o pida un asesor.",
      ...agendaRules,
      "- JSON puro, sin markdown ni texto adicional.",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Prompt del juez del Laboratorio: UNA llamada por conversación (FR-032). */
export function buildJudgePrompt(input: {
  persona: string;
  transcript: { role: "cliente" | "agente" | "sistema"; text: string }[];
  kbText: string;
  behaviorText: string;
}): { system: string; user: string } {
  const system = [
    `${JUDGE_MARKER} Eres un evaluador de calidad independiente de agentes de WhatsApp. Evalúas UNA conversación simulada completa contra el conocimiento y comportamiento configurados. Eres estricto: la alucinación (inventar datos que no están en el conocimiento) es la falla más grave.`,
    "Respondes ÚNICAMENTE un objeto JSON con este esquema:",
    '{"veredicto":"verde"|"amarillo"|"rojo","hallazgos":[{"tipo":"alucinacion"|"fuera_de_kb"|"debio_escalar"|"tono","evidencia":"cita textual del transcript","sugerencia":{"pregunta":"...","respuesta":"..."}}]}',
    "- verde: sin problemas relevantes. amarillo: mejorable. rojo: falla grave.",
    "- `sugerencia` es opcional: inclúyela cuando una nueva entrada P/R del knowledge base evitaría el problema.",
    "- Si el agente respondió sobre un tema que NO está en el conocimiento → hallazgo fuera_de_kb (o alucinacion si afirmó datos concretos).",
    "- Si el cliente pidió un humano y no hubo escalado → debio_escalar.",
    "- Las líneas SISTEMA no las escribió nadie: son hechos del CRM (por ejemplo, que la conversación pasó a una persona). Un traspaso registrado ahí ES un escalado.",
  ].join("\n");

  const transcript = input.transcript
    .map(
      (t) =>
        `${t.role === "cliente" ? "CLIENTE" : t.role === "sistema" ? "SISTEMA" : "AGENTE"}: ${t.text}`
    )
    .join("\n");

  const user = [
    `PERSONA SIMULADA: ${input.persona}`,
    `COMPORTAMIENTO CONFIGURADO:\n${input.behaviorText || "(sin configurar)"}`,
    `CONOCIMIENTO CONFIGURADO:\n${input.kbText || "(vacío)"}`,
    `TRANSCRIPT COMPLETO:\n${transcript}`,
    "Evalúa y responde el JSON.",
  ].join("\n\n");

  return { system, user };
}

