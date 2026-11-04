/**
 * Script para crear o sincronizar la cuenta de Super Admin directamente en la BD.
 * 
 * Uso:
 *   SUPER_ADMIN_EMAIL=cristhianmc303@gmail.com SUPER_ADMIN_PASSWORD=TuPassword123! node scripts/sync-admin.mjs
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

function loadEnv() {
  try {
    const raw = readFileSync(".env", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {}
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL no está definida");
  process.exit(1);
}

const adminEmail = (process.env.SUPER_ADMIN_EMAIL || "cristhianmc303@gmail.com").toLowerCase().trim();
const adminPassword = process.env.SUPER_ADMIN_PASSWORD || "Monterrial2026!";
const adminName = process.env.SUPER_ADMIN_NAME || "Super Admin";

const sql = postgres(dbUrl, { max: 1 });

async function main() {
  console.log(`🔍 Sincronizando Super Admin para: ${adminEmail}...`);

  const users = await sql`SELECT id, email FROM "user" WHERE LOWER(email) = ${adminEmail} LIMIT 1`;
  const user = users[0];
  const hashedPassword = await hashPassword(adminPassword);

  if (!user) {
    const userId = randomUUID();
    const accountId = randomUUID();
    const orgId = "org_" + randomUUID().replace(/-/g, "").slice(0, 16);
    const memberId = "mem_" + randomUUID().replace(/-/g, "").slice(0, 16);

    await sql.begin(async (tx) => {
      // 1. User
      await tx`
        INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
        VALUES (${userId}, ${adminName}, ${adminEmail}, true, NOW(), NOW())
      `;

      // 2. Account
      await tx`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}, NOW(), NOW())
      `;

      // 3. Organization
      await tx`
        INSERT INTO "organization" (id, name, slug, plan, plan_expires_at, created_at)
        VALUES (${orgId}, 'Monterrial Central', ${orgId}, 'pro', NOW() + INTERVAL '10 years', NOW())
        ON CONFLICT (id) DO NOTHING
      `;

      // 4. Member
      await tx`
        INSERT INTO "member" (id, organization_id, user_id, role, created_at)
        VALUES (${memberId}, ${orgId}, ${userId}, 'owner', NOW())
      `;
    });

    console.log(`✅ Super Admin CREADO exitosamente:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } else {
    // Actualizar contraseña
    const existingAccounts = await sql`SELECT id FROM "account" WHERE user_id = ${user.id} LIMIT 1`;
    if (existingAccounts[0]) {
      await sql`UPDATE "account" SET password = ${hashedPassword}, updated_at = NOW() WHERE id = ${existingAccounts[0].id}`;
    } else {
      await sql`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${hashedPassword}, NOW(), NOW())
      `;
    }

    // Asegurar rol owner en su membresía
    const members = await sql`SELECT id, organization_id FROM "member" WHERE user_id = ${user.id} LIMIT 1`;
    if (members[0]) {
      await sql`UPDATE "member" SET role = 'owner' WHERE id = ${members[0].id}`;
      await sql`UPDATE "organization" SET plan = 'pro' WHERE id = ${members[0].organization_id}`;
    }

    console.log(`✅ Super Admin ACTUALIZADO exitosamente:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error("❌ Error en sync-admin:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
