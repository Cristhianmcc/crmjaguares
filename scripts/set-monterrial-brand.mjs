import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const meta = {
  branding: {
    name: "Monterrial",
    accent: "#0d5bff",
    currency: "PEN"
  }
};

await sql`UPDATE organization SET metadata = ${JSON.stringify(meta)}`;
console.log("Updated organization metadata to Monterrial branding");

const rows = await sql`SELECT id, name, metadata FROM organization`;
console.log("Current organization:", rows);

await sql.end();

