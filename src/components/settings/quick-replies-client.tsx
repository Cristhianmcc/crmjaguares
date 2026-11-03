"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizarAtajo,
  TEXTO_MAX,
  type RespuestaRapida,
} from "@/lib/respuestas-rapidas";

/**
 * 049 — Ajustes → Respuestas rápidas. Las crea y edita quien configura; las
 * usa todo el equipo escribiendo `/atajo` en el compositor de la Bandeja.
 */
export function QuickRepliesClient() {
  const [lista, setLista] = useState<RespuestaRapida[] | null>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);
  // `null` = cerrado; `""` = creando una nueva; un id = editando esa.
  const [editando, setEditando] = useState<string | null>(null);
  const [atajo, setAtajo] = useState("");
  const [texto, setTexto] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [mediaSize, setMediaSize] = useState<number | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/quick-replies").catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { respuestas: RespuestaRapida[]; puedeEditar: boolean };
    setLista(d.respuestas);
    setPuedeEditar(d.puedeEditar);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrir(r: RespuestaRapida | null) {
    setEditando(r?.id ?? "");
    setAtajo(r?.atajo ?? "");
    setTexto(r?.texto ?? "");
    setMediaUrl(r?.mediaUrl ?? null);
    setMediaName(r?.mediaName ?? null);
    setMediaType(r?.mediaType ?? null);
    setMediaSize(r?.mediaSize ?? null);
    setError(null);
  }

  async function subirAdjunto(file: File) {
    setSubiendoArchivo(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/quick-replies/upload", {
      method: "POST",
      body: form,
    }).catch(() => null);
    setSubiendoArchivo(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(d?.error?.message ?? "No se pudo subir el archivo adjunto.");
      return;
    }
    const data = (await res.json()) as {
      url: string;
      name: string;
      type: string;
      size: number;
    };
    setMediaUrl(data.url);
    setMediaName(data.name);
    setMediaType(data.type);
    setMediaSize(data.size);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    const nueva = editando === "";
    const res = await fetch(nueva ? "/api/quick-replies" : `/api/quick-replies/${editando}`, {
      method: nueva ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        atajo,
        texto,
        mediaUrl,
        mediaName,
        mediaType,
        mediaSize,
      }),
    }).catch(() => null);
    setGuardando(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(d?.error?.message ?? "No se pudo guardar. Revisa la conexión.");
      return;
    }
    setEditando(null);
    void cargar();
  }

  async function borrar(r: RespuestaRapida) {
    if (!window.confirm(`¿Borrar la respuesta /${r.atajo}?`)) return;
    const res = await fetch(`/api/quick-replies/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) void cargar();
  }

  const atajoFinal = normalizarAtajo(atajo);

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Respuestas rápidas</CardTitle>
          <CardDescription>
            Lo que escribes treinta veces al día. En la Bandeja, escribe{" "}
            <span className="font-mono">/</span> y el atajo (por ejemplo{" "}
            <span className="font-mono">/horario</span>) y elige la respuesta: se
            pone en la caja y la revisas antes de mandarla.{" "}
            <span className="font-mono">{"{nombre}"}</span> se cambia por el primer
            nombre del cliente. Solo dentro de la ventana de 24 h: para reabrirla
            están las plantillas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lista === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : lista.length === 0 && editando === null ? (
            <p className="text-sm text-text-2">Aún no hay respuestas rápidas.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {lista.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[13px] font-semibold">/{r.atajo}</p>
                      {r.mediaUrl && (
                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                          <Paperclip className="h-3 w-3 text-brand" />
                          <span className="truncate max-w-[160px]">{r.mediaName || "Archivo adjunto"}</span>
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-text-2">{r.texto}</p>
                  </div>
                  {puedeEditar && (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Editar /${r.atajo}`} onClick={() => abrir(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Borrar /${r.atajo}`} onClick={() => void borrar(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {puedeEditar && editando === null && (
            <Button variant="outline" size="sm" onClick={() => abrir(null)}>
              <Plus className="h-4 w-4" /> Nueva respuesta
            </Button>
          )}

          {editando !== null && (
            <div className="space-y-3 rounded-md border bg-subtle p-3" data-testid="form-respuesta">
              <div className="space-y-1.5">
                <Label htmlFor="qr-atajo">Atajo</Label>
                <Input
                  id="qr-atajo"
                  value={atajo}
                  onChange={(e) => setAtajo(e.target.value)}
                  placeholder="horario"
                  maxLength={40}
                  autoFocus
                />
                <p className="text-xs text-text-3">
                  Se escribe como <span className="font-mono">/{atajoFinal || "atajo"}</span>: letras,
                  números, - o _, sin espacios.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qr-texto">Texto</Label>
                <Textarea
                  id="qr-texto"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  maxLength={TEXTO_MAX}
                  placeholder="Abrimos de lunes a sábado de 8:00 a 19:00."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Archivo adjunto (opcional)</Label>
                {mediaUrl ? (
                  <div className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs">
                    <Paperclip className="h-4 w-4 shrink-0 text-brand" />
                    <span className="truncate font-medium flex-1">{mediaName || "Archivo adjunto"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setMediaUrl(null);
                        setMediaName(null);
                        setMediaType(null);
                        setMediaSize(null);
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Quitar
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void subirAdjunto(f);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={subiendoArchivo}
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {subiendoArchivo ? "Subiendo archivo..." : "Adjuntar foto o documento (PDF, imagen, video)"}
                    </Button>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Al usar este atajo en la bandeja, el archivo se adjuntará automáticamente al chat.
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" disabled={guardando || !atajoFinal || !texto.trim()} onClick={() => void guardar()}>
                  {guardando ? "Guardando…" : "Guardar"}
                </Button>
                <Button size="sm" variant="outline" disabled={guardando} onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
