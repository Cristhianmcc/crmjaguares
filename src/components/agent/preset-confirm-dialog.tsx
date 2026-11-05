"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";
import { RUBRO_PRESETS, type RubroPresetId } from "@/lib/rubro-presets";

export function PresetConfirmDialog({
  presetId,
  onCancel,
  onConfirm,
}: {
  presetId: RubroPresetId;
  onCancel: () => void;
  onConfirm: (replaceKb: boolean) => Promise<void>;
}) {
  const [replaceKb, setReplaceKb] = useState(false);
  const [busy, setBusy] = useState(false);
  const preset = RUBRO_PRESETS[presetId];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(replaceKb);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-dialog-title"
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 id="preset-dialog-title" className="text-base font-semibold text-foreground">
                Cargar plantilla predefinida
              </h3>
              <p className="text-xs text-muted-foreground">{preset.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-muted-foreground hover:bg-subtle hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border bg-subtle/50 p-3.5 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Esta plantilla configurará automáticamente:</p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Bloques con servicios, tarifas de referencia y políticas del rubro.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Preguntas frecuentes (P/R) habituales listas para responder.</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Nombre del agente ({preset.agentName}), tono empático e instrucciones.</span>
            </li>
          </ul>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replaceKb}
            onChange={(e) => setReplaceKb(e.target.checked)}
            disabled={busy}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
          />
          <span>Reemplazar las entradas actuales de conocimiento (KB)</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={busy}>
            {busy ? "Cargando…" : "Confirmar y cargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RoleConfirmDialog({
  roleLabel,
  onCancel,
  onConfirm,
}: {
  roleLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-dialog-title"
        className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl animate-in zoom-in-95 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="role-dialog-title" className="text-base font-semibold text-foreground">
              Cargar rol {roleLabel}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta acción reemplaza las instrucciones y las reglas de escalado actuales, y enciende todas sus herramientas.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-muted-foreground hover:bg-subtle hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={busy}>
            {busy ? "Cargando…" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

