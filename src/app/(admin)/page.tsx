import { getDb, schema } from "@/lib/db";
import { count, eq } from "drizzle-orm";
import { getPlan } from "@/lib/planes";

export default async function AdminPage() {
  const db = getDb();

  const orgs = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      plan: schema.organization.plan,
      createdAt: schema.organization.createdAt,
      trialEndsAt: schema.organization.trialEndsAt,
    })
    .from(schema.organization)
    .orderBy(schema.organization.createdAt);

  // Count members per org
  const memberCounts = await db
    .select({
      organizationId: schema.member.organizationId,
      n: count(),
    })
    .from(schema.member)
    .groupBy(schema.member.organizationId);

  const memberMap = new Map(memberCounts.map((r) => [r.organizationId, r.n]));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        Organizaciones ({orgs.length})
      </h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4 font-medium">Nombre</th>
              <th className="pb-2 pr-4 font-medium">Plan</th>
              <th className="pb-2 pr-4 font-medium">Miembros</th>
              <th className="pb-2 pr-4 font-medium">Trial termina</th>
              <th className="pb-2 pr-4 font-medium">Creada</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => {
              const plan = getPlan(org.plan);
              const members = memberMap.get(org.id) ?? 0;
              return (
                <tr key={org.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4">{org.name}</td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                      {plan.nombre}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{members}</td>
                  <td className="py-2 pr-4">
                    {org.trialEndsAt
                      ? new Date(org.trialEndsAt).toLocaleDateString("es")
                      : "—"}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString("es")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

