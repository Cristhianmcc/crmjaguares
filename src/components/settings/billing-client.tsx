"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { PLANES, type PlanId } from "@/lib/planes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrgBillingInfo {
  organizationId: string;
  name: string;
  plan: PlanId;
  planNombre: string;
  planPrecio: number;
  activo: boolean;
  diasRestantes: number | null;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  isSuperAdmin?: boolean;
}

declare global {
  interface Window {
    Taypi?: {
      open: (options: {
        sessionToken: string;
        onSuccess?: () => void;
        onClose?: () => void;
        onExpired?: () => void;
        onError?: () => void;
      }) => void;
      close?: () => void;
      publicKey?: string;
    };
  }
}

function loadCheckoutScript(mode: "sandbox" | "production" = "sandbox"): Promise<typeof window.Taypi> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.Taypi?.open) return Promise.resolve(window.Taypi);

  return new Promise((resolve, reject) => {
    const existing = document.getElementById("taypi-checkout-script");
    if (existing) {
      if (window.Taypi?.open) return resolve(window.Taypi);
    }

    const script = document.createElement("script");
    script.id = "taypi-checkout-script";
    script.src =
      mode === "production"
        ? "https://app.taypi.pe/v1/checkout.js"
        : "https://sandbox.taypi.pe/v1/checkout.js";
    script.async = true;

    const timer = setTimeout(() => {
      script.remove();
      reject(new Error("Tiempo de espera agotado al conectar con Taypi"));
    }, 15000);

    script.onload = () => {
      clearTimeout(timer);
      if (window.Taypi?.open) {
        resolve(window.Taypi);
      } else {
        reject(new Error("El script de Taypi cargó pero no inicializó"));
      }
    };

    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error("No se pudo cargar la pasarela Taypi"));
    };

    document.head.appendChild(script);
  });
}

export function BillingClient() {
  const [info, setInfo] = useState<OrgBillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const activeOrderRef = useRef<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/billing");
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBilling();
  }, [fetchBilling]);

  // Verificar estado del pedido pendiente si el modal se cierra o tras pagar
  const checkPaymentStatus = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/payments/status/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed") {
          setSuccess("¡Pago confirmado con éxito! Tu plan ha sido renovado por 30 días.");
          setMessage(null);
          void fetchBilling();
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }, [fetchBilling]);

  async function handlePay(planId: PlanId) {
    if (payingPlan) return;
    setPayingPlan(planId);
    setMessage(null);
    setSuccess(null);

    try {
      // 1. Obtener configuración pública de Taypi
      const cfgRes = await fetch("/api/payments/config");
      const config = await cfgRes.json();
      if (!config.enabled) {
        throw new Error("La pasarela Taypi no está habilitada. Contacta al administrador.");
      }

      // 2. Cargar checkout.js dinámicamente
      const taypi = await loadCheckoutScript(config.mode);

      // 3. Crear sesión de pago en backend
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta no válida del servidor (${res.status}): ${text.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error((data.error as string) || "No se pudo iniciar el cobro.");
      }

      const orderId = String(data.orderId || "");
      const checkout_token = String(data.checkout_token || "");
      activeOrderRef.current = orderId;

      if (!taypi) throw new Error("Taypi no está disponible en la ventana.");

      taypi.publicKey = config.publicKey;

      // 4. Abrir modal con QR de Yape / Plin
      taypi.open({
        sessionToken: checkout_token,
        onSuccess: () => {
          taypi.close?.();
          void checkPaymentStatus(orderId);
        },
        onClose: () => {
          void checkPaymentStatus(orderId);
        },
        onExpired: () => {
          setMessage("El código QR de pago expiró. Puedes generar uno nuevo en cualquier momento.");
          taypi.close?.();
        },
        onError: () => {
          setMessage("Ocurrió un error al procesar el pago con QR. Intenta nuevamente.");
        },
      });

      if (config.mode === "sandbox") {
        setMessage("ℹ️ Modo Sandbox activo: Escanea con el simulador de Taypi para completar la prueba.");
      }
    } catch (err: unknown) {
      const errStr = err instanceof Error ? err.message : "Error desconocido al procesar pago";
      setMessage(errStr);
    } finally {
      setPayingPlan(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando estado de suscripción…</div>;
  }

  const isTrial = info?.plan === "trial";
  const fechaExpira = info?.planExpiresAt
    ? new Date(info.planExpiresAt).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-xl font-bold tracking-tight">Planes y Facturación</h3>
        <p className="text-sm text-muted-foreground">
          Paga y renueva tu plan mensual en Soles directamente con Yape, Plin o tu app bancaria vía Taypi.
        </p>
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm">
          <span>🎉 {success}</span>
          <Button variant="ghost" size="sm" onClick={() => setSuccess(null)}>
            Cerrar
          </Button>
        </div>
      )}

      {message && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {message}
        </div>
      )}

      {info?.isSuperAdmin && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <CardTitle className="text-base font-bold text-foreground">
                  Cuenta Super Admin (Dueño de la Plataforma)
                </CardTitle>
              </div>
              <Badge className="bg-amber-600 text-white font-semibold">Acceso Maestro</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Esta es tu cuenta principal. No necesitas pagar suscripción ni renovar planes. Desde tu Panel de Super Admin puedes dar de alta clientes, asignarles planes y gestionar sus vencimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href="/admin">
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-9">
                <Shield className="h-4 w-4" />
                Ir al Panel Super Admin (Crear y Administrar Clientes) →
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Tarjeta de estado actual */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Estado de tu cuenta</CardTitle>
            <Badge variant={info?.activo ? "default" : "destructive"}>
              {info?.activo ? "Plan Activo" : "Vencido"}
            </Badge>
          </div>
          <CardDescription>Organización: {info?.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Plan actual:</span>
            <span className="font-semibold text-foreground">{info?.planNombre}</span>
          </div>
          {isTrial ? (
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Prueba gratuita:</span>
              <span className="font-semibold text-amber-700">
                {info?.diasRestantes === 0
                  ? "Venció hoy"
                  : `Te quedan ${info?.diasRestantes} días de prueba`}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Próximo vencimiento:</span>
              <span className="font-semibold text-foreground">{fechaExpira || "Sin fecha fija"}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Métodos de pago habilitados:</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#742384] text-white">Yape</span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-[#00d09c] text-white">Plin</span>
              <span className="text-xs text-muted-foreground">QR Interoperable</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de renovación / cambio de plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Plan Básico */}
        <Card className={cn("flex flex-col relative", info?.plan === "basico" && "border-primary")}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{PLANES.basico.nombre}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {PLANES.basico.descripcion}
                </CardDescription>
              </div>
              {info?.plan === "basico" && <Badge variant="outline">Plan Actual</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">S/ {PLANES.basico.precio}</span>
              <span className="text-muted-foreground text-sm">/ mes</span>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Hasta 2 asesores simultáneos</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Hasta 1,500 contactos registrados</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Bandeja WhatsApp + Agente de IA</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Respuestas rápidas ilimitadas</span>
              </li>
            </ul>
          </CardContent>
          <div className="p-6 pt-0">
            {info?.isSuperAdmin ? (
              <Button className="w-full" variant="outline" disabled>
                Plan para clientes (S/ 79 / mes)
              </Button>
            ) : (
              <Button
                className="w-full"
                variant={info?.plan === "basico" ? "default" : "outline"}
                disabled={payingPlan !== null}
                onClick={() => void handlePay("basico")}
              >
                {payingPlan === "basico" ? "Abriendo QR…" : "Pagar S/ 79 con Yape / Plin"}
              </Button>
            )}
          </div>
        </Card>

        {/* Plan Pro */}
        <Card className={cn("flex flex-col relative border-primary shadow-sm ring-1 ring-primary", info?.plan === "pro" && "bg-primary/5")}>
          <div className="absolute -top-3 right-4">
            <span className="bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              Recomendado
            </span>
          </div>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{PLANES.pro.nombre}</CardTitle>
                <CardDescription className="text-xs mt-1">
                  {PLANES.pro.descripcion}
                </CardDescription>
              </div>
              {info?.plan === "pro" && <Badge variant="outline">Plan Actual</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-primary">S/ {PLANES.pro.precio}</span>
              <span className="text-muted-foreground text-sm">/ mes</span>
            </div>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Hasta 5 asesores simultáneos</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="font-medium text-foreground">Contactos ilimitados</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span className="font-medium text-foreground">Campañas masivas programadas</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Personalización completa de marca</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Soporte prioritario</span>
              </li>
            </ul>
          </CardContent>
          <div className="p-6 pt-0">
            {info?.isSuperAdmin ? (
              <Button className="w-full bg-emerald-600/10 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-600/10 cursor-default" variant="outline">
                ✓ Plan Maestro Activo en tu Organización
              </Button>
            ) : (
              <Button
                className="w-full shadow-sm"
                disabled={payingPlan !== null}
                onClick={() => void handlePay("pro")}
              >
                {payingPlan === "pro" ? "Abriendo QR…" : "Pagar S/ 109 con Yape / Plin"}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground flex items-center justify-between">
        <span>🔒 Pagos protegidos y procesados instantáneamente a través de <strong>Taypi</strong> (Cámara de Compensación Electrónica del Perú).</span>
      </div>
    </div>
  );
}

