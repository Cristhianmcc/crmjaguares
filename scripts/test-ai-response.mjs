import { runPipelineTurn } from '../src/server/ai/pipeline.ts';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  const org = (await sql`SELECT id FROM organization LIMIT 1`)[0];
  const profile = (await sql`SELECT * FROM agent_profile WHERE organization_id = ${org.id} LIMIT 1`)[0];
  const kb = await sql`SELECT * FROM kb_entry WHERE organization_id = ${org.id}`;
  const stages = await sql`SELECT name FROM pipeline_stage WHERE organization_id = ${org.id} ORDER BY position`;

  console.log('Testing turn: "El del viernes"');
  const res1 = await runPipelineTurn({
    organizationId: org.id,
    transcript: [
      { role: 'cliente', text: 'Hola información porfavor' },
      { role: 'agente', text: '¡Hola! Te damos la bienvenida a Escuela Deportiva Jaguares 🐆⚽ ¿Para qué edad y disciplina buscas información?' },
      { role: 'cliente', text: 'Para mi hijo de 14 años, fútbol' },
      { role: 'agente', text: 'Para 14 años en fútbol tenemos:\n\n• *Mar y Jue:* 18:30 a 19:50 · S/ 120 (27 cupos)\n• *Viernes:* 19:00 a 20:20 · S/ 120 (⚠️ *Últimos 4 cupos*)\n\n¿Cuál horario te acomoda?' },
      { role: 'cliente', text: 'El del viernes' },
    ],
  });

  console.log('--- RESULTADO 1 ("El del viernes") ---');
  console.log(JSON.stringify(res1, null, 2));

  console.log('\nTesting turn: "Y el enlace de inscripción?"');
  const res2 = await runPipelineTurn({
    organizationId: org.id,
    transcript: [
      { role: 'cliente', text: 'El del viernes' },
      { role: 'agente', text: res1.decision?.action === 'reply' ? res1.decision.text : 'Anotado el viernes' },
      { role: 'cliente', text: 'Y el enlace de inscripción?' },
    ],
  });

  console.log('--- RESULTADO 2 ("Y el enlace de inscripción?") ---');
  console.log(JSON.stringify(res2, null, 2));

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
