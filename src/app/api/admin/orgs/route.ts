import { getDb, schema } from "@/lib/db";
import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { isSuperAdminUser } from "@/server/auth/admin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const isAdmin = await isSuperAdminUser(session.user.id, session.user.email);
  if (!isAdmin) return null;
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

  // Buscar el correo del propietario (owner) de cada organización
  const owners = await db
    .select({
      organizationId: schema.member.organizationId,
      ownerEmail: schema.user.email,
      ownerName: schema.user.name,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.role, "owner"));

  const ownerMap = new Map(
    owners.map((o) => [o.organizationId, { email: o.ownerEmail, name: o.ownerName }])
  );

  const result = orgs.map((org) => {
    const owner = ownerMap.get(org.id);
    return {
      ...org,
      ownerEmail: owner?.email ?? "—",
      ownerName: owner?.name ?? "—",
      memberCount: memberMap.get(org.id) ?? 0,
    };
  });

  return NextResponse.json(result);
}
