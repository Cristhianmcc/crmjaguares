import { SettingsNav } from "@/components/settings/settings-nav";
import { agendaEnabled } from "@/server/agenda/flag";
import { atribucionEnabled } from "@/server/attribution/flag";
import { isChannelEnabled } from "@/server/channels/enabled";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionOrNull();
  let rubro = "servicios";
  if (session) {
    const db = getDb();
    const row = await db
      .select({ rubro: schema.organization.rubro })
      .from(schema.organization)
      .where(eq(schema.organization.id, session.organizationId))
      .limit(1);
    if (row[0]?.rubro) rubro = row[0].rubro;
  }
  const hasAgenda = agendaEnabled(rubro);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[17px] font-bold tracking-tight">Configuración</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <SettingsNav
          agenda={hasAgenda}
          atribucion={atribucionEnabled()}
          instagram={isChannelEnabled("instagram")}
          messenger={isChannelEnabled("messenger")}
          tiktok={isChannelEnabled("tiktok")}
        />
        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
