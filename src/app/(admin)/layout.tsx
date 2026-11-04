import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isSuperAdminUser } from "@/server/auth/admin";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const isAdmin = await isSuperAdminUser(session.user.id, session.user.email);
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-bold text-lg flex items-center gap-2">
            <span>🛡️</span>
            <span>Panel Super-Admin</span>
          </Link>
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
            Monterrial CRM
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Admin: {session.user.email}
          </span>
          <Link href="/inbox">
            <Button variant="outline" size="sm">
              Volver al CRM →
            </Button>
          </Link>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
