"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  deportesDe,
  diaCorto,
  edadDe,
  resumenClase,
  resumenDe,
  type ClaseEscuela,
} from "@/lib/escuela";
import { cn } from "@/lib/utils";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "ok"; clases: ClaseEscuela[]; actualizadoEn: string; fuente: string | null }
  | { tipo: "error"; motivo: string };

/**
 * Cupos por clase, leídos del sistema de la escuela.
 *
 * No es una pantalla de administración: es la hoja que el equipo tiene al lado
 * mientras contesta WhatsApp. Por eso lo primero que se ve es qué clase tiene
 * lugar, y cada clase se puede copiar como una línea de chat.
 */
export function CuposClient({
  inicial,
  actualizadoEnInicial,
  fuenteInicial,
  motivoInicial,
}: {
  inicial: ClaseEscuela[];
  actualizadoEnInicial: string | null;
  fuenteInicial: string | null;
  motivoInicial: string | null;
}) {
  const [estado, setEstado] = useState<Estado>(
    motivoInicial
      ? { tipo: "error", motivo: motivoInicial }
      : {
          tipo: "ok",
          clases: inicial,
          actualizadoEn: actualizadoEnInicial ?? new Date().toISOString(),
          fuente: fuenteInicial,
        }
  );
  const [busqueda, setBusqueda] = useState("");
  const [deporte, setDeporte] = useState<string | null>(null);
  const [copiada, setCopiada] = useState<string | null>(null);

  // Memoizada: si se recalculara en cada render, los useMemo de abajo
  // cambiarían de dependencia siempre y no servirían de nada.
  const clases = useMemo(
    () => (estado.tipo === "ok" ? estado.clases : []),
    [estado]
  );
  const deportes = useMemo(() => deportesDe(clases), [clases]);
  const resumen = useMemo(() => resumenDe(clases), [clases]);

  const visibles = useMemo(() => {
    const q = busqueda
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return clases.filter((c) => {
      if (deporte && c.deporte !== deporte) return false;
      if (!q) return true;
      const texto = `${c.deporte} ${c.categoria} ${c.nivel ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return texto.includes(q);
    });
  }, [clases, deporte, busqueda]);

  async function actualizar() {
    setEstado({ tipo: "cargando" });
    const res = await fetch("/api/escuela/cupos?refresh=true").catch(() => null);
    if (!res?.ok) {
      setEstado({ tipo: "error", motivo: "no_responde" });
      return;
    }
    const data = (await res.json()) as
      | {
          ok: true;
          clases: ClaseEscuela[];
          actualizadoEn: string;
          fuente: string | null;
        }
      | { ok: false; motivo: string };
    setEstado(
      data.ok
        ? {
            tipo: "ok",
            clases: data.clases,
            actualizadoEn: data.actualizadoEn,
            fuente: data.fuente,
          }
        : { tipo: "error", motivo: data.motivo }
    );
  }

  async function copiar(clase: ClaseEscuela) {
    try {
      await navigator.clipboard.writeText(resumenClase(clase));
      setCopiada(clase.id);
      window.setTimeout(() => setCopiada(null), 1600);
    } catch {
      // Portapapeles bloqueado: no se avisa de algo que no pasó.
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Escuela · Cupos</p>
            <h1 className="mt-1 text-[22px] font-[800] tracking-[-0.03em]">
              Cupos por clase
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-text-2">
              Horarios y vacantes tal como están en el sistema de la escuela.
              Sirve para contestar sin abrir la otra pestaña.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void actualizar()}
            disabled={estado.tipo === "cargando"}
          >
            <RefreshCw
              className={cn(
                "mr-1.5 h-4 w-4",
                estado.tipo === "cargando" && "animate-spin"
              )}
              strokeWidth={1.8}
              aria-hidden
            />
            Actualizar
          </Button>
        </div>

        {estado.tipo === "ok" && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
            <Dato etiqueta="Clases" valor={resumen.clases} />
            <Dato etiqueta="Vacantes" valor={resumen.vacantes} />
            <Dato
              etiqueta="Llenas"
              valor={resumen.llenas}
              alerta={resumen.llenas > 0}
            />
          </div>
        )}
      </header>

      {estado.tipo === "error" ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={AlertTriangle}
            title="No pude consultar el sistema de la escuela"
            description={<ExplicacionFallo motivo={estado.motivo} />}
            action={
              <Button variant="secondary" size="sm" onClick={() => void actualizar()}>
                Reintentar
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3"
                strokeWidth={1.8}
                aria-hidden
              />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar disciplina o categoría"
                aria-label="Buscar disciplina o categoría"
                className="h-9 w-[15rem] pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip activo={deporte === null} onClick={() => setDeporte(null)}>
                Todas
              </Chip>
              {deportes.map((d) => (
                <Chip key={d} activo={deporte === d} onClick={() => setDeporte(d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {estado.tipo === "cargando" && clases.length === 0 ? (
              <p className="text-sm text-text-3">Consultando horarios…</p>
            ) : visibles.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Ninguna clase coincide"
                description="Prueba con otra disciplina o borra la búsqueda. Si el sistema de la escuela no tiene horarios activos, aquí no hay nada que mostrar."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibles.map((clase) => (
                  <TarjetaClase
                    key={clase.id}
                    clase={clase}
                    copiada={copiada === clase.id}
                    onCopiar={() => void copiar(clase)}
                  />
                ))}
              </div>
            )}

            {estado.tipo === "ok" && (
              <p className="mt-6 text-[11.5px] text-text-3">
                Actualizado {fecha(estado.actualizadoEn)}
                {estado.fuente ? ` · origen ${estado.fuente}` : ""}. Los cupos
                viven en el sistema de la escuela; aquí solo se leen.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  alerta = false,
}: {
  etiqueta: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2">
      <p className="kicker">{etiqueta}</p>
      <p
        className={cn(
          "mt-0.5 text-[20px] font-[800] leading-none tabular-nums",
          alerta ? "text-warning-text" : "text-foreground"
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        activo
          ? "border-transparent bg-brand text-brand-fg"
          : "text-text-2 hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function TarjetaClase({
  clase,
  copiada,
  onCopiar,
}: {
  clase: ClaseEscuela;
  copiada: boolean;
  onCopiar: () => void;
}) {
  return (
    <article className="group flex flex-col rounded-lg border bg-popover p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold leading-tight">
            {clase.deporte}
          </h2>
          <p className="mt-0.5 text-[12px] text-text-3">
            {clase.categoria}
            {clase.nivel ? ` · ${clase.nivel}` : ""}
          </p>
        </div>
        <Badge
          variant={
            clase.libres === 0
              ? "destructive"
              : clase.libres <= 2
                ? "warning"
                : "success"
          }
        >
          {clase.libres === 0 ? "Lleno" : `${clase.libres} cupos`}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-[15px] font-medium tabular-nums">
          {clase.horaInicio}–{clase.horaFin}
        </span>
        <span className="text-[11.5px] text-text-3">{edadDe(clase)}</span>
      </div>

      <ul className="mt-3 flex-1 space-y-1.5">
        {clase.dias.map((d) => {
          const pct =
            d.cupoMaximo > 0 ? (d.cuposOcupados / d.cupoMaximo) * 100 : 100;
          return (
            <li key={d.dia} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[11.5px] capitalize text-text-2">
                {diaCorto(d.dia)}
              </span>
              <span
                role="progressbar"
                aria-valuenow={d.cuposOcupados}
                aria-valuemin={0}
                aria-valuemax={d.cupoMaximo}
                aria-label={`${clase.deporte} ${clase.categoria}, ${d.dia}: ${d.cuposOcupados} de ${d.cupoMaximo} ocupados`}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    d.libres === 0
                      ? "bg-danger"
                      : d.libres <= 2
                        ? "bg-warning"
                        : "bg-success"
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </span>
              <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-3">
                {d.cuposOcupados}/{d.cupoMaximo}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-[11.5px] text-text-3">
          {clase.precio !== null
            ? `S/ ${clase.precio.toFixed(2)}`
            : "Precio por plan"}
          {clase.plan ? ` · ${clase.plan}` : ""}
        </span>
        <button
          onClick={onCopiar}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-[11.5px] font-medium text-text-2 hover:bg-accent hover:text-foreground"
        >
          {copiada ? (
            <Check
              className="h-3.5 w-3.5 text-success-text"
              strokeWidth={2.2}
              aria-hidden
            />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          )}
          {copiada ? "Copiado" : "Copiar"}
        </button>
      </div>
    </article>
  );
}

function ExplicacionFallo({ motivo }: { motivo: string }) {
  if (motivo === "sin_configurar") {
    return (
      <>
        Falta la dirección del backend. Agrega{" "}
        <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[12px]">
          ESCUELA_API_URL
        </code>{" "}
        al <code className="font-mono text-[12px]">.env</code> (por ejemplo{" "}
        <code className="font-mono text-[12px]">http://localhost:3003</code>) y
        reinicia el CRM.
      </>
    );
  }
  if (motivo === "respuesta_invalida") {
    return (
      <>
        El backend contestó algo que no entiendo. Revisa que{" "}
        <code className="font-mono text-[12px]">GET /api/horarios</code> devuelva
        horarios con los campos de siempre.
      </>
    );
  }
  return (
    <>
      El backend de la escuela no contestó. Levántalo con{" "}
      <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[12px]">
        cd jaguares-cms-dev/server &amp;&amp; npm run dev
      </code>{" "}
      y vuelve a intentar.
    </>
  );
}

function fecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "recién";
  }
}
