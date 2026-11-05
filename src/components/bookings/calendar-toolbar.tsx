"use client";

import { useRef } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Smartphone } from "lucide-react";
import { MAX_RANGE_DAYS, type CalendarView } from "@/lib/time/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 215 — La barra del calendario, como la de Google Calendar: Hoy, ‹ ›, el
 * rango que se está viendo (tocarlo abre un selector para saltar a cualquier
 * fecha) y el cambio de vista. En la Lista, el rango se elige con Desde–Hasta,
 * como la lista de reuniones de Zoom.
 */

const VIEW_LABEL: Record<CalendarView, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  lista: "Lista",
};

const PERIOD: Record<CalendarView, string> = {
  dia: "día",
  semana: "semana",
  mes: "mes",
  lista: "rango",
};

export function CalendarToolbar({
  view,
  anchor,
  listTo,
  label,
  loading,
  onToday,
  onShift,
  onJump,
  onView,
  onListRange,
  onBlock,
  onSync,
}: {
  view: CalendarView;
  anchor: string;
  listTo: string;
  label: string;
  loading: boolean;
  onToday: () => void;
  onShift: (dir: 1 | -1) => void;
  onJump: (day: string) => void;
  onView: (view: CalendarView) => void;
  onListRange: (from: string, to: string) => void;
  onBlock: () => void;
  onSync?: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-6">
      <h2 className="mr-1 text-[17px] font-bold tracking-tight">Citas</h2>

      <Button variant="outline" size="sm" onClick={onToday}>
        Hoy
      </Button>

      <div className="flex items-center">
        <NavButton label={`anterior ${PERIOD[view]}`} onClick={() => onShift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <NavButton label={`siguiente ${PERIOD[view]}`} onClick={() => onShift(1)}>
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>

      {view !== "lista" ? (
        <button
          type="button"
          onClick={() => {
            if (!picker.current) return;
            if (typeof picker.current.showPicker === "function") {
              picker.current.showPicker();
            } else {
              picker.current.focus();
            }
          }}
          className="relative inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-base font-semibold tracking-tight hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          aria-label={`Saltar a fecha. Mostrando: ${label}`}
        >
          <span>{label}</span>
          <ChevronDown className="h-4 w-4 text-text-3" />
          <input
            ref={picker}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={anchor}
            onChange={(e) => {
              if (e.target.value) onJump(e.target.value);
            }}
            className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
          />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-text-3">Del</span>
          <input
            type="date"
            aria-label="Inicio del rango"
            value={anchor}
            max={listTo}
            onChange={(e) => {
              if (e.target.value) onListRange(e.target.value, listTo);
            }}
            className="h-8 rounded-sm border bg-background px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          />
          <span className="text-text-3">al</span>
          <input
            type="date"
            aria-label="Fin del rango"
            value={listTo}
            min={anchor}
            onChange={(e) => {
              if (e.target.value) onListRange(anchor, e.target.value);
            }}
            className="h-8 rounded-sm border bg-background px-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
          />
          <span className="text-xs text-text-3">({label})</span>
        </div>
      )}

      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-strong border-t-brand" aria-label="Cargando" />
      )}

      <div className="ml-auto flex items-center gap-2">
        <div role="group" aria-label="Vista" className="inline-flex rounded-full border bg-secondary p-0.5">
          {(Object.keys(VIEW_LABEL) as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              className={cn(
                "h-7 rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                view === v ? "bg-background text-foreground shadow-sm" : "text-text-3 hover:text-foreground"
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>

        {onSync && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSync}
            className="gap-1.5 text-xs h-8 border-border hover:bg-accent text-foreground font-medium"
            title="Sincronizar citas con Google Calendar y iPhone"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
        )}

        <Button size="sm" onClick={onBlock} aria-label="Bloquear horario">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Bloquear horario</span>
        </Button>
      </div>
    </header>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label.charAt(0).toUpperCase() + label.slice(1)}
      title={label.charAt(0).toUpperCase() + label.slice(1)}
      className="flex h-8 w-8 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
    >
      {children}
    </button>
  );
}
