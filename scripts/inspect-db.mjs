import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  const profiles = await sql`SELECT * FROM agent_profile`;
  console.log('--- AGENT PROFILES ---');
  console.log(JSON.stringify(profiles, null, 2));

  const kb = await sql`SELECT id, kind, question, answer, content FROM kb_entry`;
  console.log('--- KB ENTRIES ---');
  console.log(JSON.stringify(kb, null, 2));

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
