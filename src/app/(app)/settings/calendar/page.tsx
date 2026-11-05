import { notFound, redirect } from "next/navigation";
import { AgendaClient } from "@/components/settings/agenda-client";
import { agendaEnabled } from "@/server/agenda/flag";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AgendaSettingsPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const db = getDb();
  const row = await db
    .select({ rubro: schema.organization.rubro })
    .from(schema.organization)
    .where(eq(schema.organization.id, session.organizationId))
    .limit(1);

  if (!agendaEnabled(row[0]?.rubro)) notFound();
  return <AgendaClient />;
}
