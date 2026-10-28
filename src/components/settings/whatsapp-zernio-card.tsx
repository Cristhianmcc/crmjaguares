"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, TriangleAlert, Unplug, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Conexion = {
  source: "meta" | "zernio";
  accountRef: string | null;
  displayPhoneNumber: string | null;
  status: "connected" | "reconnect_required";
} | null;

/**
 * Conectar el WhatsApp de la escuela a través de Zernio.
 *
 * Vive aparte del asistente de Meta a propósito: son dos caminos distintos
 * para el mismo número y mezclarlos en un formulario obligaría a explicar en
 * cada campo cuál aplica. Aquí solo se piden las dos cosas que Zernio exige
 * (llave y `account.id`) y se enseña la URL a la que hay que apuntar su
 * webhook.
 */
export function ZernioWhatsappCard({ onSaved }: { onSaved?: () => void }) {
  const [conexion, setConexion] = useState<Conexion>(null);
  const [cargado, setCargado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [accountRef, setAccountRef] = useState("");
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [numero, setNumero] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/whatsapp").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) setConexion(c.connection);
    if (w?.url) setWebhookUrl(String(w.url));
    setCargado(true);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function conectar() {
    setError(null);
    setGuardando(true);
    const res = await fetch("/api/settings/whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "zernio",
        accountRef,
        token,
        webhookSecret: webhookSecret || undefined,
        displayPhoneNumber: numero || undefined,
      }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(
        data?.error?.message ??
          "No se pudo guardar. Revisa la llave y el account.id."
      );
      return;
    }
    setListo(true);
    setAbierto(false);
    setToken("");
    setWebhookSecret("");
    await cargar();
    onSaved?.();
  }

  async function desconectar() {
    setGuardando(true);
    await fetch("/api/settings/whatsapp", { method: "DELETE" }).catch(
      () => null
    );
    setGuardando(false);
    setListo(false);
    await cargar();
    onSaved?.();
  }

  async function copiar() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      // portapapeles bloqueado: el campo sigue seleccionable
    }
  }

  if (!cargado) return null;

  const conectadoPorZernio = conexion?.source === "zernio";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-ink" strokeWidth={2} aria-hidden />
              WhatsApp por Zernio
            </CardTitle>
            <CardDescription>
              Si el número de la escuela ya vive en Zernio, no hace falta montar
              la app de Meta: el CRM recibe y responde por su API unificada.
            </CardDescription>
          </div>
          {conectadoPorZernio && (
            <Badge variant={conexion.status === "connected" ? "success" : "warning"}>
              {conexion.status === "connected" ? "Conectado" : "Reconectar"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {conectadoPorZernio && !abierto ? (
          <>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Cuenta</dt>
                <dd className="font-mono text-[13px]">{conexion.accountRef}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Número</dt>
                <dd>{conexion.displayPhoneNumber ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setAbierto(true)}>
                <Link2 className="mr-1.5 h-4 w-4" strokeWidth={1.8} aria-hidden />
                Reconectar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={guardando}
                onClick={() => void desconectar()}
              >
                <Unplug className="mr-1.5 h-4 w-4" strokeWidth={1.8} aria-hidden />
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            {listo && (
              <p className="flex items-center gap-1.5 text-sm text-success-text">
                <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Guardado. Apunta el webhook de Zernio a la URL de abajo si aún
                no lo hiciste.
              </p>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="zernio-account">Account ID de Zernio</Label>
                <Input
                  id="zernio-account"
                  value={accountRef}
                  onChange={(e) => setAccountRef(e.target.value)}
                  placeholder="El de WhatsApp → Overview, con el botón de copiar"
                  autoComplete="off"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  En el panel de Zernio aparece como <code className="font-mono">Account ID</code>{" "}
                  debajo del nombre del número.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zernio-token">Llave de Zernio</Label>
                <Input
                  id="zernio-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Se guarda cifrada; solo se muestran sus últimos 4"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="zernio-secret">
                    Secreto de firma <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="zernio-secret"
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="Verifica que el evento viene de Zernio"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zernio-numero">
                    Número visible <span className="text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="zernio-numero"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="+51 973 324 460"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-danger-text">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!accountRef.trim() || !token.trim() || guardando}
                onClick={() => void conectar()}
              >
                {guardando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
                Conectar con Zernio
              </Button>
              {conectadoPorZernio && (
                <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </>
        )}

        {webhookUrl && (
          <div className="rounded-md border bg-subtle p-3">
            <p className="kicker mb-1">Webhook</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[12px]">
                {webhookUrl}
              </code>
              <Button variant="ghost" size="sm" onClick={() => void copiar()}>
                {copiado ? (
                  <Check className="h-4 w-4 text-success-text" strokeWidth={2.2} aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                )}
                <span className="sr-only">Copiar la URL del webhook</span>
              </Button>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              En Zernio, da de alta esta URL con el evento{" "}
              <code className="font-mono">message.received</code>. La misma URL
              acepta los eventos de Meta: un solo endpoint para los dos caminos.
            </p>
            {esUrlLocal(webhookUrl) && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-warning-soft bg-warning-tint p-2.5 text-[11.5px] leading-relaxed text-warning-text">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                <span>
                  Esta dirección apunta a tu computadora y Zernio no puede
                  llegar a <code className="font-mono">localhost</code>. Para
                  probar en local, expón el CRM con un túnel (cloudflared,
                  ngrok) y pon esa dirección en <code className="font-mono">APP_BASE_URL</code>;
                  en producción, usa tu dominio.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** ¿La URL vive en esta máquina? Entonces ningún proveedor puede entregarle. */
function esUrlLocal(url: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}
