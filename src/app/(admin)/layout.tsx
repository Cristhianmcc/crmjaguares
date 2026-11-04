import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
  if (!ADMIN_EMAIL) redirect("/");

  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.email !== ADMIN_EMAIL) redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center gap-4">
        <span className="font-bold text-lg">🛡️ Panel Admin</span>
        <span className="text-muted-foreground text-sm">
          Monterrial Super Admin
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
