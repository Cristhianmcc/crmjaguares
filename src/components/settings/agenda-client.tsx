"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  CONNECTOR_META,
  CONNECTOR_ORDER,
  type ConnectorId,
} from "@/lib/agenda-connectors";
import { ConnectorCredentials } from "@/components/settings/connector-credentials";

/**
 * 015 — Ajustes → Agenda: cuándo atiende el negocio y cómo se entrega la
 * reunión.
 */

type Interval = { start: string; end: string };
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type WeeklyHours = Partial<Record<DayKey, Interval[]>>;

type Settings = {
  weeklyHours: WeeklyHours;
  slotMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  timezone: string;
  connector: ConnectorId;
  meetingLink: string | null;
};

type SyncInfo = {
  httpFeedUrl: string;
  webcalUrl: string;
  googleCalUrl: string;
};

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const DEFAULT_INTERVAL: Interval = { start: "09:00", end: "18:00" };

export function AgendaClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sync, setSync] = useState<SyncInfo | null>(null);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [slots, setSlots] = useState<{ label: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const [cfg, avail] = await Promise.all([
        fetch("/api/calendar/settings").catch(() => null),
        fetch("/api/calendar/availability").catch(() => null),
      ]);
      if (cfg?.ok) {
        const data = (await cfg.json()) as { settings: Settings; sync?: SyncInfo };
        setSettings(data.settings);
        if (data.sync) setSync(data.sync);
      }
      if (avail?.ok) {
        const data = (await avail.json()) as { slots: { label: string }[] };
        setSlots(data.slots.slice(0, 5));
      } else {
        setSlots([]);
      }
    })();
  }, []);

  async function refreshPreview() {
    const res = await fetch("/api/calendar/availability").catch(() => null);
    if (!res?.ok) return setSlots([]);
    const data = (await res.json()) as { slots: { label: string }[] };
    setSlots(data.slots.slice(0, 5));
  }

  function patch(next: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...next } : s));
    setSaved(false);
  }

  function toggleDay(day: DayKey) {
    if (!settings) return;
    const current = settings.weeklyHours[day];
    const weeklyHours = { ...settings.weeklyHours };
    if (current && current.length > 0) delete weeklyHours[day];
    else weeklyHours[day] = [{ ...DEFAULT_INTERVAL }];
    patch({ weeklyHours });
  }

  function updateInterval(day: DayKey, index: number, next: Partial<Interval>) {
    if (!settings) return;
    const list = [...(settings.weeklyHours[day] ?? [])];
    const current = list[index];
    if (!current) return;
    list[index] = { ...current, ...next };
    patch({ weeklyHours: { ...settings.weeklyHours, [day]: list } });
  }

  function addInterval(day: DayKey) {
    if (!settings) return;
    const list = [...(settings.weeklyHours[day] ?? [])];
    list.push({ start: "14:00", end: "18:00" });
    patch({ weeklyHours: { ...settings.weeklyHours, [day]: list } });
  }

  function removeInterval(day: DayKey, index: number) {
    if (!settings) return;
    const list = (settings.weeklyHours[day] ?? []).filter((_, i) => i !== index);
    const weeklyHours = { ...settings.weeklyHours };
    if (list.length === 0) delete weeklyHours[day];
    else weeklyHours[day] = list;
    patch({ weeklyHours });
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/calendar/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? `Error HTTP ${res.status}`);
      }
      setSaved(true);
      await refreshPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-text-3">Cargando configuración…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Sincronización con iPhone y Google Calendar */}
      {sync && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">
              Sincronización con teléfono (Google Calendar e iPhone)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Sincroniza tus citas en vivo para recibir notificaciones y alarmas en tu dispositivo móvil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={sync.webcalUrl}
                className="flex-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="default"
                  className="w-full text-xs h-9 font-medium"
                >
                  Suscribirse en iPhone / iPad / Mac
                </Button>
              </a>

              <a
                href={sync.googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  className="w-full text-xs h-9 font-medium"
                >
                  Abrir en Google Calendar
                </Button>
              </a>

              <Button
                variant="outline"
                className="text-xs h-9 px-3 font-medium"
                onClick={() => {
                  navigator.clipboard.writeText(sync.httpFeedUrl);
                  setCopiedFeed(true);
                  setTimeout(() => setCopiedFeed(false), 3000);
                }}
              >
                {copiedFeed ? "Enlace copiado" : "Copiar enlace directo"}
              </Button>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-medium text-foreground">
                Instrucciones de sincronización:
              </p>
              <p>
                - iPhone / iPad / Mac: Abre el enlace desde tu dispositivo y confirma la suscripción. Las citas se actualizan automáticamente y recibirás una alerta 30 minutos antes.
              </p>
              <p>
                - Google Calendar (Android / PC): Haz clic en Abrir en Google Calendar o copia el enlace y agrégalo en Otros calendarios &gt; Desde URL.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Horario de atención</CardTitle>
          <CardDescription>
            Los días y horas en que el negocio recibe citas. Fuera de aquí el
            agente no ofrece huecos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const intervals = settings.weeklyHours[key];
            const active = Boolean(intervals && intervals.length > 0);
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-2 rounded-sm border p-3 sm:flex-row sm:items-center sm:justify-between",
                  active ? "border-border" : "border-dashed border-border-soft"
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-xs border text-xs font-semibold transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-contrast"
                        : "border-border bg-surface"
                    )}
                    aria-label={`Alternar ${label}`}
                  >
                    {active ? "✓" : ""}
                  </button>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !active && "text-text-3"
                    )}
                  >
                    {label}
                  </span>
                </div>

                {active && (
                  <div className="flex flex-col gap-2 sm:items-end">
                    {intervals?.map((it, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={it.start}
                          onChange={(e) =>
                            updateInterval(key, i, { start: e.target.value })
                          }
                          className="h-8 w-28 text-xs"
                        />
                        <span className="text-xs text-text-3">a</span>
                        <Input
                          type="time"
                          value={it.end}
                          onChange={(e) =>
                            updateInterval(key, i, { end: e.target.value })
                          }
                          className="h-8 w-28 text-xs"
                        />
                        {intervals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInterval(key, i)}
                            className="text-xs text-text-3 hover:text-danger-text"
                            aria-label="Quitar franja"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addInterval(key)}
                      className="text-xs text-brand-text hover:underline"
                    >
                      + otra franja
                    </button>
                  </div>
                )}

                {!active && (
                  <span className="text-xs text-text-3">Cerrado</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo se generan los huecos</CardTitle>
          <CardDescription>
            La duración de cada cita, cuánto margen dejar y con cuánta
            anticipación se puede agendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="slot">Duración de la cita (min)</Label>
            <Input
              id="slot"
              type="number"
              min={10}
              max={240}
              step={5}
              value={settings.slotMinutes}
              onChange={(e) => patch({ slotMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buffer">Respiro entre citas (min)</Label>
            <Input
              id="buffer"
              type="number"
              min={0}
              max={60}
              step={5}
              value={settings.bufferMinutes}
              onChange={(e) => patch({ bufferMinutes: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice">Aviso mínimo (horas)</Label>
            <Input
              id="notice"
              type="number"
              min={0}
              max={72}
              value={settings.minNoticeHours}
              onChange={(e) => patch({ minNoticeHours: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ahead">Agenda abierta (días)</Label>
            <Input
              id="ahead"
              type="number"
              min={1}
              max={60}
              value={settings.maxDaysAhead}
              onChange={(e) => patch({ maxDaysAhead: Number(e.target.value) })}
            />
          </div>
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="tz">Zona horaria</Label>
            <Input
              id="tz"
              value={settings.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              placeholder="America/Lima"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Zona horaria oficial de Perú: <span className="font-mono text-foreground font-semibold">America/Lima</span> (UTC -05:00).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo se entrega la reunión</CardTitle>
          <CardDescription>
            El enlace fijo no depende de nadie y es ideal para citas presenciales. Los demás conectan con tu propia
            cuenta del proveedor si realizas videollamadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {CONNECTOR_ORDER.map((id) => {
            const meta = CONNECTOR_META[id];
            const active = settings.connector === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => patch({ connector: id })}
                className={cn(
                  "block w-full rounded-sm border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-brand bg-brand-tint"
                    : "border-border hover:bg-accent"
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    active && "text-brand-text"
                  )}
                >
                  {meta.label}
                  {!meta.external && (
                    <span className="ml-2 text-[11px] font-normal text-text-3">
                      sin dependencias (recomendado para locales físicos)
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-text-2">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {settings.connector === "enlace-fijo" && (
        <Card>
          <CardHeader>
            <CardTitle>Dirección del local o Sala virtual</CardTitle>
            <CardDescription>
              Se comparte tal cual al confirmar una cita. Si atiendes de forma presencial, puedes colocar aquí la dirección del consultorio o local.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={settings.meetingLink ?? ""}
              onChange={(e) => patch({ meetingLink: e.target.value })}
              placeholder="Ej: Av. Larco 456, Consultorio 301 (opcional)"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar Configuración"}
        </Button>
        {saved && <span className="text-sm text-brand-text">Guardado</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {/* Las credenciales se guardan por su cuenta, no con el botón de arriba:
          se validan contra el proveedor antes de tocar la base. */}
      {settings.connector !== "enlace-fijo" && (
        <ConnectorCredentials connector={settings.connector} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Próximos turnos disponibles para el bot</CardTitle>
          <CardDescription>
            Horarios reales en vivo que el asistente de IA ofrecerá por WhatsApp cuando un cliente solicite agendar cita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slots === null && <p className="text-sm text-text-3">Calculando…</p>}
          {slots?.length === 0 && (
            <p className="text-sm text-text-3">
              Sin turnos libres por el momento: revisa tu horario de atención, el aviso mínimo o si todos los turnos ya están ocupados.
            </p>
          )}
          {slots && slots.length > 0 && (
            <ul className="space-y-1 text-sm">
              {slots.map((s, i) => (
                <li key={i}>{s.label}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
