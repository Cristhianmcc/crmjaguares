import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  console.log('--- ACTUALIZANDO AGENT PROFILE ---');
  await sql`
    UPDATE agent_profile
    SET 
      instructions = ${'Orienta al apoderado para encontrar la disciplina y el grupo que le corresponde al alumno según su edad o año de nacimiento. Usa SIEMPRE los horarios, cupos y precios vigentes del catálogo en vivo como tu única verdad. REGLA ESTRICTA: En Escuela Jaguares NO existen clases de prueba, bajo ninguna circunstancia las menciones ni ofrezcas. PRIVACIDAD: Nunca des listas ni nombres de alumnos inscritos; responde de forma breve y concisa que por seguridad y privacidad de los menores no se comparte esa información, e inmediatamente redirige la conversación preguntando por la edad y disciplina para la vacante que busca. El objetivo es asesorar con claridad y canalizar al cliente a realizar su inscripción oficial 100% online en la página web oficial https://jaguarescar.com.'},
      escalation_rules = ${'Solo escala a un humano (handoff) cuando el cliente pida EXPLÍCITAMENTE hablar con un asesor o persona humana (ej: "quiero hablar con un asesor", "pásame con un humano", "teléfono de reclamos"), o por reclamos administrativos o médicos graves. NUNCA escales por consultas de matrícula, inscripciones, precios, horarios, cupos, dudas de pagos o enlaces de la página web.'},
      greeting = ${'¡Hola! Te damos la bienvenida a Escuela Deportiva Jaguares 🐆⚽ ¿Para qué edad y disciplina buscas información?'},
      updated_at = NOW()
  `;

  console.log('--- ACTUALIZANDO KB ENTRIES ---');
  await sql`
    UPDATE kb_entry
    SET answer = 'En la Escuela Deportiva Jaguares no contamos con clases de prueba. La inscripción se realiza directamente a través de nuestra página web oficial https://jaguarescar.com, asegurando la vacante en el horario elegido.'
    WHERE question ILIKE '%prueba%'
  `;

  await sql`
    UPDATE kb_entry
    SET answer = 'La inscripción se realiza 100% online en nuestra web oficial https://jaguarescar.com. Seleccionas la disciplina, la categoría según la edad, eliges el horario con cupo disponible y completas la matrícula directamente en la plataforma.'
    WHERE question ILIKE '%inscribo%'
  `;

  await sql`
    UPDATE kb_entry
    SET answer = 'El pago se realiza en línea de manera segura en nuestra web oficial https://jaguarescar.com al momento de completar la inscripción, usando los métodos autorizados en la plataforma.'
    WHERE question ILIKE '%paga%'
  `;

  console.log('--- REANUDANDO CONVERSACIONES PAUSADAS ---');
  const res = await sql`
    UPDATE conversation
    SET handoff_at = NULL, handoff_reason = NULL
    WHERE handoff_at IS NOT NULL
    RETURNING id
  `;
  console.log(`Reanudadas ${res.length} conversaciones.`);

  console.log('--- VERIFICANDO VALORES ACTUALIZADOS ---');
  const profiles = await sql`SELECT name, instructions, escalation_rules, greeting FROM agent_profile`;
  console.log('Profile:', JSON.stringify(profiles, null, 2));

  const kb = await sql`SELECT question, answer FROM kb_entry WHERE question IS NOT NULL`;
  console.log('KB:', JSON.stringify(kb, null, 2));

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
