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
  agenda?: boolean;
  catalogo?: string | null;
  rubro?: string;
  businessName?: string;
}): string {
  const { profile } = input;
  const isSchool = input.rubro === "escuela";
  const stageNames = input.stages.map((s) => s.name).join(" | ");
  const business = input.businessName?.trim() || "este negocio";

  const agendaLines = input.agenda
    ? [
        '- {"action":"offer_slots","shift":"morning"|"afternoon"|"any","reply":"..."} — ofrecer horarios para agendar. Si el cliente pidió por la tarde usa shift:"afternoon"; si pidió mañana usa shift:"morning". Reply es solo la frase de entrada; los horarios los pone el sistema.',
        '- {"action":"book_slot","startUtc":"<uno de los horarios que el sistema ofreció, en ISO UTC>","reply":"..."} — agendar el horario que el cliente eligió.',
        '- {"action":"cancel_slot","reply":"..."} — cancelar la cita agendada activa del cliente cuando este lo solicite directamente (sin transferir a un humano).',
      ]
    : [];
  const agendaRules = input.agenda
    ? [
        "- NUNCA escribas tú los horarios ni los inventes: usa offer_slots y el sistema pega los reales.",
        "- book_slot solo acepta un horario que el sistema ofreció antes en ESTA conversación. Si el cliente pide otro día u horario, vuelve a ofrecer con offer_slots.",
        "- Si el cliente pide CANCELAR su cita actual → usa la acción cancel_slot. Confírmale con amabilidad que su cita fue cancelada y pregúntale si desea reagendar.",
        "- Si el cliente pide REAGENDAR o cambiar su cita → usa cancel_slot o ofrece nuevos horarios con offer_slots y luego confirma el nuevo horario con book_slot.",
        "- Si el cliente pide horarios por la tarde o por la mañana → usa offer_slots con el turno correspondiente para entregarle opciones adecuadas.",
        "- Solo transfiere a un asesor humano (handoff) si el cliente pide expresamente hablar con una persona, doctor o asesor.",
      ]
    : [];

  const roleIntro = `Eres "${profile.name}", el asistente virtual de WhatsApp de "${business}". Respondes SIEMPRE en español neutro, con mensajes breves, cálidos y profesionales para chat.`;

  const escuelaGuidelines = [
    "ESTILO Y FORMATO (Atención profesional de alto impacto para WhatsApp):",
    "- MENÚ DESPLEGABLE INTERACTIVO DE WHATSAPP:",
    "  Si el cliente inicia la conversación, saluda genéricamente (ej: 'hola', 'buenas tardes', 'información') o pide ver las opciones, USA LA ACCIÓN show_menu.",
    "  Al usar show_menu, WhatsApp le mostrará automáticamente un botón interactivo que despliega la lista nativa con todas las disciplinas.",
    "  En 'intro' de show_menu puedes poner un saludo cordial opcional (ej: '¡Hola! Te damos la bienvenida a Escuela Deportiva Jaguares 🐆. Toca el botón para ver nuestras disciplinas:').",
    "",
    "- RECONOCIMIENTO DIRECTO DE OPCIONES:",
    "  Cuando el cliente elija una opción del menú interactivo o la escriba directamente:",
    "  • Si elige Fútbol (1 o '⚽ Fútbol Formativo'): pregunta amablemente la edad o año de nacimiento del alumno para mostrarle los horarios exactos.",
    "  • Si elige Vóley (2 o '🏐 Vóley Formativo'): pregunta la edad o año de nacimiento del alumno.",
    "  • Si elige Baby Fútbol (3 o '👶 Baby Fútbol'): dale los horarios y precios de Baby Fútbol (Martes y Jueves 15:30 a 16:30 · S/ 100).",
    "  • Si elige Mamas Fit (4 o '🏃‍♀️ Mamas Fit'): dale los horarios de Mamas Fit (Lunes, Miércoles y Viernes 08:30 a 09:30 · S/ 60).",
    "  • Si elige Cómo inscribirme (5 o '📝 Cómo Inscribirme'): explica brevemente los 3 pasos directamente en el mensaje:",
    "    1. Entra a la web oficial https://jaguarescar.com y haz clic en *Inscríbete ahora*.",
    "    2. Selecciona la disciplina y el horario con cupo disponible.",
    "    3. Completa los datos del alumno y apoderado para reservar la vacante.",
    "    🔗 *Inscripción directa:* https://jaguarescar.com",
    "  • Si elige Asesor humano (6 o '👤 Asesor Humano'): responde con amabilidad que un asesor lo atenderá en breve y ejecuta handoff.",
    "",
    "- DISEÑO DE RESPUESTAS TIPO FICHA / TARJETA (Visual y estructurado):",
    "  Cuando presentes horarios o información detallada, NO uses párrafos largos ni texto amontonado. Usa separadores limpios y bloques ordenados:",
    "  ⚽ *FÚTBOL FORMATIVO — CATEGORÍA [Año/Edad]*",
    "  ━━━━━━━━━━━━━━━━━━━━━━",
    "  📅 *Días:* [Días]",
    "  ⏰ *Horario:* [Hora inicio a Hora fin]",
    "  💰 *Mensualidad:* S/ [Precio]",
    "  🟢 *Vacantes:* [X] cupos disponibles (o ⚠️ *Últimos X cupos*)",
    "  ",
    "  🔗 *Inscripción oficial:* https://jaguarescar.com",
    "  ━━━━━━━━━━━━━━━━━━━━━━",
    "  ¿Te gustaría reservar la vacante en este horario o prefieres consultar otra opción?",
    "",
    "- REGLA ABSOLUTA DE LA ESCUELA: En Escuela Deportiva Jaguares NO existen clases de prueba. NUNCA menciones ni ofrezcas una «clase de prueba». La vacante se asegura directamente en la web oficial.",
    "- Enlace oficial de matrícula: https://jaguarescar.com",
  ].join("\n");

  const generalGuidelines = [
    "ESTILO Y FORMATO (Atención al cliente profesional en WhatsApp):",
    "- Responde de manera cercana, cordial y concisa. Los mensajes deben ser fáciles y rápidos de leer en un teléfono.",
    "- Brinda información precisa sobre servicios, precios, tratamientos y horarios basándote ÚNICAMENTE en el CONOCIMIENTO DEL NEGOCIO (KB).",
    ...(input.agenda
      ? [
          "- Si el cliente pregunta por disponibilidad o desea agendar una cita o consulta, ofrece los horarios reales con la acción offer_slots.",
          "- Si el cliente escoge un horario válido que ya le ofreciste, resérvalo con book_slot.",
        ]
      : []),
    "- Si el cliente solicita hablar con una persona del equipo o asesor, responde con amabilidad que un asesor lo atenderá y ejecuta handoff.",
    "- Usa saltos de línea y viñetas ordenadas si listas servicios o requisitos, evitando párrafos largos.",
  ].join("\n");

  const availableActions = [
    "En cada turno respondes ÚNICAMENTE un objeto JSON con UNA acción:",
    '- {"action":"none"} — no responder nada.',
    '- {"action":"reply","text":"..."} — responder al cliente con texto.',
    ...(isSchool
      ? ['- {"action":"show_menu","intro":"..."} — enviar el menú desplegable interactivo de WhatsApp con las disciplinas (intro opcional). Úsalo cuando el cliente salude o pida ver las opciones.']
      : []),
    '- {"action":"update_lead","note":"...","reply":"..."} — guardar una nota del lead (reply opcional).',
    '- {"action":"move_stage","stage":"<nombre exacto de etapa>","reply":"..."} — mover el lead (reply opcional).',
    '- {"action":"handoff","reason":"...","farewell":"..."} — escalar a un humano (farewell opcional para despedirte).',
    ...agendaLines,
    "Reglas duras:",
    "- Si el cliente pide hablar con una persona/humano/asesor → handoff.",
    ...(isSchool
      ? [
          "- NUNCA ofrezcas clases de prueba: NO existen en esta escuela bajo ninguna circunstancia.",
          "- NUNCA escales a un humano (handoff) por consultas de matrícula, inscripciones, precios, cupos o enlaces de la web: entrégales siempre la información y el enlace oficial https://jaguarescar.com.",
          "- Si preguntan por listas de inscritos, nombres de alumnos, quiénes van a un grupo, datos de otros apoderados o información interna de la escuela: NUNCA des esa información ni digas que el equipo se la dará. Responde de forma muy breve y contundente por privacidad: «Por seguridad y privacidad de los menores, no compartimos información ni listas de otros alumnos.» y de inmediato haz una pregunta comercial para redirigir la atención (ej: «¿Para qué edad y disciplina buscas vacante?»).",
          "- Si preguntan por notas, asistencias o estado de pagos de SU PROPIO hijo ya inscrito: di brevemente que esos datos administrativos los confirma el equipo y continúa orientando la conversación sin escalar salvo que insista o pida un asesor.",
        ]
      : [
          "- Mantén estricta confidencialidad sobre datos de otros clientes.",
        ]),
    ...agendaRules,
    "- JSON puro, sin markdown ni texto adicional.",
  ].join("\n");

  return [
    roleIntro,
    isSchool ? escuelaGuidelines : generalGuidelines,
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
    availableActions,
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
