"use client";

import { useState } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type CampaignItem = {
  id: string;
  tipo: "renovacion" | "aviso";
  nombre: string;
  mensaje: string;
  status: "borrador" | "enviando" | "enviada" | "cancelada";
  sentCount: number;
  errorCount: number;
  createdAt: string;
  finishedAt: string | null;
};

const PLANTILLAS = [
  {
    tipo: "renovacion" as const,
    titulo: "💳 Recordatorio de Renovación Mensual",
    nombre: "Renovación Mensualidad Noviembre",
    mensaje:
      "¡Hola {nombre}! 🐯 Te saludamos desde la Escuela Oficial Jaguares. Te recordamos que la mensualidad vence a fin de mes. Puedes asegurar la continuidad de tu pequeño(a) renovando en nuestra web oficial: https://jaguarescar.com/renovacion o respondiendo aquí si tienes alguna duda. ¡Muchas gracias!",
  },
  {
    tipo: "aviso" as const,
    titulo: "📢 Aviso Operativo / Mantenimiento",
    nombre: "Aviso de Mantenimiento de Canchas",
    mensaje:
      "¡Hola {nombre}! 📢 Te comunicamos desde la Escuela Jaguares que por labores de mantenimiento en la cancha principal, los entrenamientos de hoy se reprograman 1 hora más tarde. Agradecemos su comprensión y puntualidad. ⚽🐯",
  },
  {
    tipo: "aviso" as const,
    titulo: "🏆 Torneo y Festival Deportivo",
    nombre: "Convocatoria Festival Jaguares",
    mensaje:
      "¡Hola {nombre}! 🏆 Este sábado celebraremos nuestro Festival Deportivo Jaguares con partidos amistosos y premiación para todos los alumnos. ¡Los esperamos en familia! Si tienes consultas sobre el rol de partidos, escríbenos por aquí.",
  },
];

export function CampanasClient({ inicial = [] }: { inicial?: CampaignItem[] }) {
  const [campanas, setCampanas] = useState<CampaignItem[]>(inicial);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipo, setTipo] = useState<"renovacion" | "aviso">("renovacion");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Cargar campañas si no vinieron iniciales
  const cargarCampanas = async () => {
    try {
      const res = await fetch("/api/campanas");
      if (res.ok) {
        const data = await res.json();
        if (data.campaigns) setCampanas(data.campaigns);
      }
    } catch (e) {
      console.error("Error al cargar campañas:", e);
    }
  };

  useState(() => {
    if (inicial.length === 0) {
      cargarCampanas();
    }
  });

  // Totales
  const totalEnviados = campanas.reduce((sum, c) => sum + c.sentCount, 0);
  const totalCampanas = campanas.length;
  const enviadas = campanas.filter((c) => c.status === "enviada").length;

  const aplicarPlantilla = (p: (typeof PLANTILLAS)[0]) => {
    setTipo(p.tipo);
    setNombre(p.nombre);
    setMensaje(p.mensaje);
  };

  const handleCrear = async (enviarDirecto = false) => {
    if (!nombre.trim() || !mensaje.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, nombre, mensaje }),
      });
      if (!res.ok) throw new Error("Error al guardar la campaña");
      const { campaign } = await res.json();

      if (enviarDirecto) {
        setCampanas([campaign, ...campanas]);
        await handleEnviar(campaign.id);
      } else {
        setCampanas([campaign, ...campanas]);
      }

      setNombre("");
      setMensaje("");
      setModalAbierto(false);
      setMensajeExito("Campaña creada con éxito");
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const handleEnviar = async (id: string) => {
    if (!confirm("¿Deseas enviar esta campaña a los contactos de WhatsApp ahora?")) return;
    setEnviandoId(id);
    try {
      const res = await fetch(`/api/campanas/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error("Error al despachar la campaña");
      const data = await res.json();
      setCampanas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.campaign } : c))
      );
      setMensajeExito(`¡Campaña enviada a ${data.resumen.enviados} contactos con éxito!`);
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setEnviandoId(null);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar este borrador?")) return;
    try {
      const res = await fetch(`/api/campanas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setCampanas((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de éxito */}
      {mensajeExito && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Campañas Masivas de WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Avisos operativos masivos y recordatorios de renovación mensual para la Escuela Jaguares.
          </p>
        </div>
        <Button onClick={() => setModalAbierto(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Campañas Creadas</span>
            <Megaphone className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalCampanas}</p>
          <span className="text-xs text-muted-foreground">{enviadas} enviadas con éxito</span>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Mensajes Despachados</span>
            <Send className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalEnviados}</p>
          <span className="text-xs text-muted-foreground">Directo a los chats de WhatsApp</span>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Audiencia Activa</span>
            <Users className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">100%</p>
          <span className="text-xs text-muted-foreground">Personalizado con nombre del papá</span>
        </div>
      </div>

      {/* Modal / Compositor */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Crear Campaña de WhatsApp
              </h2>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Plantillas rápidas */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Cargar plantilla predefinida:
              </label>
              <div className="flex flex-wrap gap-2">
                {PLANTILLAS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => aplicarPlantilla(p)}
                    className="rounded-lg border bg-muted/40 hover:bg-muted px-3 py-1.5 text-xs text-foreground font-medium transition"
                  >
                    {p.titulo}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo de Campaña</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo("renovacion")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    tipo === "renovacion"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Renovación Mensual
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("aviso")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    tipo === "aviso"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Bell className="h-4 w-4" />
                  Aviso Operativo
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {tipo === "renovacion"
                  ? "Dirigido a padres con alumnos inscritos en el pipeline."
                  : "Dirigido a todos los contactos registrados en la escuela."}
              </p>
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre de la Campaña (interno)</label>
              <Input
                placeholder="Ej. Renovación Noviembre 2026"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            {/* Mensaje */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Mensaje de WhatsApp</label>
                <button
                  type="button"
                  onClick={() => setMensaje((m) => m + " {nombre}")}
                  className="text-xs text-primary hover:underline"
                >
                  + Insertar variable &#123;nombre&#125;
                </button>
              </div>
              <Textarea
                rows={4}
                placeholder="Escribe el mensaje aquí. Puedes usar {nombre} para personalizar..."
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />
            </div>

            {/* Previsualización en vivo estilo WhatsApp */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Vista previa en WhatsApp:
              </label>
              <div className="rounded-xl bg-[#0b141a] p-4 text-sm text-[#e9edef] shadow-inner font-sans">
                <div className="max-w-[85%] rounded-lg bg-[#005c4b] p-3 text-sm shadow leading-relaxed whitespace-pre-wrap">
                  {mensaje
                    ? mensaje.replace(/\{nombre\}/gi, "Carlos")
                    : "Escribe un mensaje para ver cómo lo verá el papá..."}
                  <div className="mt-1 text-[10px] text-right text-emerald-200/60">12:00 p. m. ✓✓</div>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <Button
                variant="outline"
                onClick={() => setModalAbierto(false)}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleCrear(false)}
                disabled={guardando || !nombre.trim() || !mensaje.trim()}
              >
                Guardar Borrador
              </Button>
              <Button
                onClick={() => handleCrear(true)}
                disabled={guardando || !nombre.trim() || !mensaje.trim()}
                className="gap-2"
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Ahora
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Campañas */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold">Historial de Campañas</h2>
          <p className="text-xs text-muted-foreground">
            Borradores preparados y comunicados enviados a la fecha.
          </p>
        </div>

        {campanas.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Aún no has creado campañas masivas.
            </p>
            <Button size="sm" onClick={() => setModalAbierto(true)}>
              Crear primera campaña
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {campanas.map((c) => (
              <div
                key={c.id}
                className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-muted/30 transition"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{c.nombre}</span>
                    <Badge
                      variant={c.tipo === "renovacion" ? "default" : "secondary"}
                      className="text-[11px]"
                    >
                      {c.tipo === "renovacion" ? "💳 Renovación" : "📢 Aviso"}
                    </Badge>
                    <Badge
                      variant={
                        c.status === "enviada"
                          ? "default"
                          : c.status === "enviando"
                          ? "outline"
                          : "secondary"
                      }
                      className={
                        c.status === "enviada"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : ""
                      }
                    >
                      {c.status === "enviada"
                        ? "Enviada"
                        : c.status === "enviando"
                        ? "Enviando..."
                        : "Borrador"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.mensaje}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {c.status === "enviada" && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {c.sentCount} mensajes entregados
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2">
                  {c.status === "borrador" && (
                    <Button
                      size="sm"
                      onClick={() => handleEnviar(c.id)}
                      disabled={enviandoId === c.id}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {enviandoId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Enviar ahora
                    </Button>
                  )}
                  {c.status === "borrador" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEliminar(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
