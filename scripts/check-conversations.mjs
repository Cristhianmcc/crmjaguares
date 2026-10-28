import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  const convs = await sql`
    SELECT c.id, c.contact_id, c.ai_enabled, c.handoff_at, c.handoff_reason, c.updated_at 
    FROM conversation c
    ORDER BY c.updated_at DESC 
    LIMIT 3
  `;
  console.log('--- RECENT CONVERSATIONS ---');
  console.log(JSON.stringify(convs, null, 2));

  if (convs.length > 0) {
    const messages = await sql`
      SELECT id, direction, text, created_at 
      FROM message 
      WHERE conversation_id = ${convs[0].id}
      ORDER BY created_at ASC
    `;
    console.log('--- MESSAGES IN MOST RECENT CONVERSATION ---');
    console.log(JSON.stringify(messages, null, 2));
  }

  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
