import { getDb, schema } from "@/lib/db";
import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

async function requireAdmin() {
  const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  if (!ADMIN_EMAIL) return null;
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.email !== ADMIN_EMAIL) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const db = getDb();
  const orgs = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      plan: schema.organization.plan,
      createdAt: schema.organization.createdAt,
      trialEndsAt: schema.organization.trialEndsAt,
      planExpiresAt: schema.organization.planExpiresAt,
    })
    .from(schema.organization)
    .orderBy(schema.organization.createdAt);

  const memberCounts = await db
    .select({
      organizationId: schema.member.organizationId,
      n: count(),
    })
    .from(schema.member)
    .groupBy(schema.member.organizationId);

  const memberMap = new Map(memberCounts.map((r) => [r.organizationId, r.n]));

  const result = orgs.map((org) => ({
    ...org,
    memberCount: memberMap.get(org.id) ?? 0,
  }));

  return NextResponse.json(result);
}

