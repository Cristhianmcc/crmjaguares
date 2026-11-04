"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldAlert } from "lucide-react";
import type { Branding } from "@/lib/branding";
import type { Apariencia } from "@/lib/temas";
import type { ResolvedCommit } from "@/lib/version";
import { AppNav } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BandaSinConexion } from "@/components/banda-sin-conexion";
import { AtajosGlobales } from "@/components/atajos-globales";

/**
 * Cascarón de la app en dos modos:
 * - Escritorio (lg+): el panel lateral es una columna fija.
 * - Móvil/tableta: el lateral sale como cajón.
 * Incluye protección de expiración de plan (Paywall) y ocultamiento de Super Admin.
 */
export function AppShell({
  branding,
  userName,
  role,
  isSuperAdmin = false,
  planExpired = false,
  apariencia,
  commit,
  agenda = false,
  kicker,
  aviso = null,
  children,
}: {
  branding: Branding;
  userName: string;
  role: string;
  isSuperAdmin?: boolean;
  planExpired?: boolean;
  apariencia: Apariencia;
  commit?: ResolvedCommit;
  agenda?: boolean;
  kicker?: string;
  aviso?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const esBandeja = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const esFacturacion = pathname.startsWith("/settings/billing");
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="app-marco app-escala flex overflow-hidden lg:gap-[var(--hueco)] lg:p-[var(--hueco)]">
      {navOpen && (
        <button
          aria-label="Cerrar el menú"
          tabIndex={-1}
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
        />
      )}

      <AppNav
        branding={branding}
        commit={commit}
        userName={userName}
        role={role}
        isSuperAdmin={isSuperAdmin}
        planExpired={planExpired}
        apariencia={apariencia}
        agenda={agenda}
        kicker={kicker}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-background lg:gap-[var(--hueco)] lg:bg-transparent">
        <header className="flex h-12 shrink-0 items-center gap-1.5 border-b bg-background px-2 text-foreground lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Abrir el menú"
            aria-expanded={navOpen}
            className="rounded-md p-2 text-text-2 hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <BrandLogo branding={branding} className="min-w-0" />
        </header>

        {aviso}
        <BandaSinConexion />
        <AtajosGlobales agenda={agenda} role={role} />

        {/* Si el plan expiró y NO es super admin, bloquear el uso regular y dirigir a facturación */}
        {planExpired && !isSuperAdmin && !esFacturacion ? (
          <main className="min-h-0 min-w-0 flex-1 overflow-auto flex items-center justify-center p-4 sm:p-6 lg:tarjeta">
            <div className="max-w-md w-full text-center space-y-4 p-6 sm:p-8 rounded-2xl border border-destructive/30 bg-card shadow-xl animate-in fade-in-50">
              <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-foreground">Tu periodo de prueba ha finalizado</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tus contactos, chats e información de WhatsApp están guardados de forma segura. Para reactivar tu CRM y que tu agente siga respondiendo, elige y activa un plan a continuación.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/settings/billing">
                  <Button className="w-full bg-primary hover:bg-primary/90 font-semibold text-sm h-11 gap-2 shadow-md">
                    <span>Activar mi plan con Yape o Plin →</span>
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                ¿Prefieres pagar por transferencia bancaria? Comunícate con tu asesor para que te active +30 días al instante.
              </p>
            </div>
          </main>
        ) : (
          <main
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-hidden bg-background",
              esBandeja ? "lg:bg-transparent" : "lg:tarjeta"
            )}
          >
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
