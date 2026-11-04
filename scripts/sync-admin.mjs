/**
 * Script para crear o sincronizar la cuenta de Super Admin directamente en la BD,
 * vinculándolo a la organización principal para no perder WhatsApp ni DeepSeek.
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

  const primaryOrgs = await sql`SELECT id, name FROM "organization" ORDER BY created_at ASC LIMIT 1`;
  const primaryOrg = primaryOrgs[0];

  const users = await sql`SELECT id, email FROM "user" WHERE LOWER(email) = ${adminEmail} LIMIT 1`;
  let user = users[0];
  const hashedPassword = await hashPassword(adminPassword);

  if (!user) {
    const userId = randomUUID();
    const accountId = randomUUID();

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
        VALUES (${userId}, ${adminName}, ${adminEmail}, true, NOW(), NOW())
      `;
      await tx`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}, NOW(), NOW())
      `;
    });

    user = { id: userId, email: adminEmail };
    console.log(`✅ Super Admin CREADO: ${adminEmail}`);
  } else {
    // Actualizar contraseña
    const accounts = await sql`SELECT id FROM "account" WHERE user_id = ${user.id} LIMIT 1`;
    if (accounts[0]) {
      await sql`UPDATE "account" SET password = ${hashedPassword}, updated_at = NOW() WHERE id = ${accounts[0].id}`;
    } else {
      await sql`
        INSERT INTO "account" (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (${randomUUID()}, ${user.id}, 'credential', ${user.id}, ${hashedPassword}, NOW(), NOW())
      `;
    }
    console.log(`✅ Contraseña de Super Admin actualizada`);
  }

  // Vincular con la organización principal si existe
  if (primaryOrg) {
    const members = await sql`SELECT id FROM "member" WHERE user_id = ${user.id} AND organization_id = ${primaryOrg.id} LIMIT 1`;
    if (!members[0]) {
      const anyMember = await sql`SELECT id FROM "member" WHERE user_id = ${user.id} LIMIT 1`;
      if (anyMember[0]) {
        await sql`UPDATE "member" SET organization_id = ${primaryOrg.id}, role = 'owner' WHERE id = ${anyMember[0].id}`;
      } else {
        await sql`
          INSERT INTO "member" (id, organization_id, user_id, role, created_at)
          VALUES (${'mem_' + randomUUID().replace(/-/g, '').slice(0, 16)}, ${primaryOrg.id}, ${user.id}, 'owner', NOW())
        `;
      }
    } else {
      await sql`UPDATE "member" SET role = 'owner' WHERE id = ${members[0].id}`;
    }

    // Asegurar plan pro
    await sql`UPDATE "organization" SET plan = 'pro', plan_expires_at = NOW() + INTERVAL '10 years' WHERE id = ${primaryOrg.id}`;
    console.log(`✅ Vinculado como Owner a la organización principal '${primaryOrg.name}'`);
  }

  // Eliminar organizaciones huérfanas creadas por error si están vacías
  if (primaryOrg) {
    await sql`
      DELETE FROM "organization" 
      WHERE id != ${primaryOrg.id} 
      AND name = 'Monterrial Central'
      AND id NOT IN (SELECT organization_id FROM "credentials" WHERE organization_id IS NOT NULL)
      AND id NOT IN (SELECT organization_id FROM "ai_credentials" WHERE organization_id IS NOT NULL)
    `.catch(() => {});
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error("❌ Error en sync-admin:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
