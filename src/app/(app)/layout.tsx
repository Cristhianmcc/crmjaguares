import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getSessionOrNull } from "@/lib/auth/session";
import { aparienciaActual } from "@/server/apariencia";
import { getBranding } from "@/server/branding";
import { AppShell } from "@/components/app-shell";
import { resolveCommit } from "@/lib/version";
import { agendaEnabled } from "@/server/agenda/flag";
import { enabledChannels } from "@/server/channels/enabled";
import { navKicker } from "@/lib/channels";
import { avisoIaDe } from "@/server/ai/aviso";
import { AvisoIaBanner } from "@/components/avisos/aviso-ia";
import { isSuperAdminUser } from "@/server/auth/admin";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isPlanActive } from "@/lib/plan-guard";
import type { PlanId } from "@/lib/planes";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  const branding = await getBranding(session.organizationId);
  const authSession = await getAuth().api.getSession({
    headers: await headers(),
  });
  // 062 — Para el botón de sol y luna: salta a la pareja del tema actual.
  const { apariencia } = await aparienciaActual(session.organizationId);
  // El agente encendido y sin con qué pensar se ve desde fuera igual que un
  // bot roto. Se resuelve en el servidor y en el layout para que se vea desde
  // CUALQUIER pantalla, no solo desde el panel de un contacto (#85).
  const aviso = await avisoIaDe(session.organizationId);

  // Verificación de Super Admin (solo el dueño real de la plataforma ve el panel)
  const isSuperAdmin = await isSuperAdminUser(session.userId, authSession?.user.email ?? "");

  // Verificación de expiración de plan y rubro de negocio
  const db = getDb();
  const orgRows = await db
    .select({
      name: schema.organization.name,
      plan: schema.organization.plan,
      trialEndsAt: schema.organization.trialEndsAt,
      planExpiresAt: schema.organization.planExpiresAt,
      rubro: schema.organization.rubro,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, session.organizationId))
    .limit(1);

  const org = orgRows[0];
  const isJaguaresOrSchool =
    org?.rubro === "escuela" ||
    (org?.name ?? "").toLowerCase().includes("jaguares") ||
    branding.name.toLowerCase().includes("jaguares");

  const rubro = isJaguaresOrSchool ? "escuela" : (org?.rubro ?? "servicios");
  const hasCupos = rubro === "escuela";
  const hasAgenda = rubro !== "escuela" && rubro !== "comercio";

  const planActive = isSuperAdmin || !org || isPlanActive({
    plan: (org.plan || "trial") as PlanId,
    trialEndsAt: org.trialEndsAt,
    planExpiresAt: org.planExpiresAt,
  });

  return (
    <AppShell
      branding={branding}
      userName={authSession?.user.name ?? "Usuario"}
      role={session.role}
      isSuperAdmin={isSuperAdmin}
      planExpired={!planActive}
      apariencia={apariencia}
      commit={resolveCommit()}
      agenda={hasAgenda}
      cupos={hasCupos}
      kicker={navKicker([...enabledChannels()])}
      aviso={<AvisoIaBanner aviso={aviso} />}
    >
      {children}
    </AppShell>
  );
}
