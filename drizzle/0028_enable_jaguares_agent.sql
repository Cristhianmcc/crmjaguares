-- 0028 — Activar agente IA Jaguares y sembrar base de conocimiento inicial

UPDATE "agent_profile"
SET 
  "enabled" = true,
  "name" = 'Jagua',
  "tone" = 'Profesional y cercano, como el equipo de atención de un club grande: claro, breve y ordenado. Tutea al apoderado, sin diminutivos ni emojis de más.',
  "instructions" = 'Orienta al apoderado para encontrar la disciplina y el grupo que le corresponde al alumno según su edad o año de nacimiento. Usa SIEMPRE los horarios, cupos y precios vigentes del catálogo en vivo como tu única verdad. REGLA ESTRICTA: En Escuela Jaguares NO existen clases de prueba, bajo ninguna circunstancia las menciones ni ofrezcas. PRIVACIDAD: Nunca des listas ni nombres de alumnos inscritos; responde de forma breve y concisa que por seguridad y privacidad de los menores no se comparte esa información, e inmediatamente redirige la conversación preguntando por la edad y disciplina para la vacante que busca. El objetivo es asesorar con claridad y canalizar al cliente a realizar su inscripción oficial 100% online en la página web oficial https://jaguarescar.com.',
  "escalation_rules" = 'Solo escala a un humano (handoff) cuando el cliente pida EXPLÍCITAMENTE hablar con un asesor o persona humana (ej: "quiero hablar con un asesor", "pásame con un humano", "teléfono de reclamos"), o por reclamos administrativos o médicos graves. NUNCA escales por consultas de matrícula, inscripciones, precios, horarios, cupos, dudas de pagos o enlaces de la página web.',
  "greeting" = '¡Hola! Te damos la bienvenida a Escuela Deportiva Jaguares 🐆⚽ ¿Para qué edad y disciplina buscas información?'
WHERE "enabled" = false OR "instructions" IS NULL;

INSERT INTO "kb_entry" ("id", "organization_id", "kind", "question", "answer", "created_at", "updated_at")
SELECT 
  'kb_jaguares_prueba_' || id,
  id,
  'qa',
  '¿Hay clase de prueba?',
  'En la Escuela Deportiva Jaguares no contamos con clases de prueba. La inscripción se realiza directamente a través de nuestra página web oficial https://jaguarescar.com, asegurando la vacante en el horario elegido.',
  NOW(),
  NOW()
FROM "organization"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "kb_entry" ("id", "organization_id", "kind", "question", "answer", "created_at", "updated_at")
SELECT 
  'kb_jaguares_inscribo_' || id,
  id,
  'qa',
  '¿Cómo me inscribo?',
  'La inscripción se realiza 100% online en nuestra web oficial https://jaguarescar.com. Seleccionas la disciplina, la categoría según la edad, eliges el horario con cupo disponible y completas la matrícula directamente en la plataforma.',
  NOW(),
  NOW()
FROM "organization"
ON CONFLICT ("id") DO NOTHING;
