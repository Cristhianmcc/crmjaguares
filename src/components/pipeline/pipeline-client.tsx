"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  MessageSquareText,
  Search,
  Settings2,
  TrendingUp,
  Trophy,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { LossReason, PriorityValue, StageDto } from "@/lib/types";
import { formatMoneyCents, sumable } from "@/lib/money";
import { cn, formatPhone } from "@/lib/utils";
import { ContactAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/components/inbox/helpers";
import { StageManager } from "./stage-manager";
import { LossReasonDialog } from "./loss-reason-dialog";
import { AmountDialog } from "./amount-dialog";
import { PriorityBadge } from "./priority-picker";
import { LeadDrawer } from "./lead-drawer";

export type BoardLead = {
  id: string;
  stageId: string;
  position: number;
  lastActivityAt: string | null;
  contact: { id: string; name: string; phone: string | null };
  conversationId: string | null;
  amountCents: number | null;
  currency: string | null;
  priority: PriorityValue | null;
};

export function PipelineClient() {
  const [stages, setStages] = useState<StageDto[]>([]);
  const [currency, setCurrency] = useState("MXN");
  const [leads, setLeads] = useState<BoardLead[]>([]);
  const [activeLead, setActiveLead] = useState<BoardLead | null>(null);
  const [managing, setManaging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const leadsFiltrados = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return leads;
    const qDigits = q.replace(/\D/g, "");
    return leads.filter((l) => {
      const nameMatch = l.contact.name.toLowerCase().includes(q);
      const phoneDigits = l.contact.phone ? l.contact.phone.replace(/\D/g, "") : "";
      const phoneMatch = qDigits ? phoneDigits.includes(qDigits) : false;
      return nameMatch || phoneMatch;
    });
  }, [leads, searchQuery]);

  const pipelineMetrics = useMemo(() => {
    let totalCents = 0;
    for (const l of leads) {
      if (
        l.amountCents !== null &&
        sumable({ amountCents: l.amountCents, currency: l.currency }, currency)
      ) {
        totalCents += l.amountCents;
      }
    }
    return { totalCents };
  }, [leads, currency]);
  /** Arrastre hacia una etapa perdida, esperando el motivo. */
  const [pendingLoss, setPendingLoss] = useState<{
    leadId: string;
    stageId: string;
    name: string;
  } | null>(null);
  /** Tarjeta cuyo monto se está capturando. */
  const [editandoMonto, setEditandoMonto] = useState<BoardLead | null>(null);
  /**
   * Trato abierto en el cajón. Se guarda el ID y no el objeto: así el cajón
   * lee siempre del tablero y refleja al instante lo que se cambie desde
   * dentro, en vez de enseñar una copia que envejece.
   */
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = leads.find((l) => l.id === abiertoId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const refetch = useCallback(async () => {
    const res = await fetch("/api/pipeline/board").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as {
      stages: StageDto[];
      leads: BoardLead[];
      currency?: string;
    };
    if (data.currency) setCurrency(data.currency);
    setStages(data.stages);
    setLeads(data.leads);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  function onDragStart(event: DragStartEvent) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  async function moverLead(
    leadId: string,
    overStage: string,
    loss?: { reason: LossReason; note: string }
  ) {
    const position = leads.filter((l) => l.stageId === overStage).length;
    // Optimista + persistencia
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stageId: overStage, position } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stageId: overStage,
        position,
        ...(loss
          ? { lossReason: loss.reason, ...(loss.note ? { lossNote: loss.note } : {}) }
          : {}),
      }),
    }).catch(() => null);
    void refetch();
  }

  async function guardarMonto(leadId: string, cents: number | null) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, amountCents: cents } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      // Sin `stageId`: esto NO mueve la tarjeta, solo escribe el importe.
      body: JSON.stringify({ amountCents: cents }),
    }).catch(() => null);
    void refetch();
  }

  async function guardarPrioridad(leadId: string, priority: PriorityValue | null) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, priority } : l))
    );
    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priority }),
    }).catch(() => null);
    void refetch();
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const leadId = String(event.active.id);
    const overStage = event.over ? String(event.over.id) : null;
    if (!overStage) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === overStage) return;

    // Perder un trato exige motivo. Se pregunta ANTES de mover: si el dueño
    // cancela, la tarjeta ni siquiera parpadea fuera de su columna.
    const destino = stages.find((s) => s.id === overStage);
    if (destino?.kind === "lost") {
      setPendingLoss({ leadId, stageId: overStage, name: lead.contact.name });
      return;
    }

    await moverLead(leadId, overStage);
  }

  /**
   * Cambiar de etapa desde el cajón. Entra por la MISMA puerta que el
   * arrastre: perder un trato exige motivo venga de donde venga, y duplicar
   * esa regla aquí sería tener dos sitios donde olvidarla.
   */
  function moverDesdeCajon(leadId: string, stageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;
    const destino = stages.find((s) => s.id === stageId);
    if (destino?.kind === "lost") {
      setPendingLoss({ leadId, stageId, name: lead.contact.name });
      return;
    }
    void moverLead(leadId, stageId);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[17px] font-bold tracking-tight">Embudo de Ventas</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-md border border-border-strong bg-subtle px-2 py-0.5 font-medium text-text-2">
                <Users className="h-3.5 w-3.5 text-text-3" />
                {searchQuery.trim()
                  ? `${leadsFiltrados.length} de ${leads.length} prospectos`
                  : `${leads.length} prospectos`}
              </span>
              <span className="flex items-center gap-1 rounded-md border border-brand/20 bg-brand-tint/60 px-2 py-0.5 font-semibold text-brand-text">
                <TrendingUp className="h-3.5 w-3.5" />
                {formatMoneyCents(pipelineMetrics.totalCents, currency)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
              <Settings2 className="h-4 w-4" /> Gestionar etapas
            </Button>
          </div>
        </div>

        {/* Buscador rápido de prospectos estilo MiCierro */}
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o teléfono (WhatsApp)..."
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-7 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </header>

      {/* El tablero se arrastra en horizontal; en el teléfono cada columna
          se detiene en su sitio (snap) para no quedar a medio camino. */}
      <div className="flex-1 snap-x snap-mandatory overflow-x-auto p-3 sm:snap-none sm:p-4">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={(e) => void onDragEnd(e)}
        >
          <div className="flex h-full gap-3">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                currency={currency}
                onEditAmount={setEditandoMonto}
                onOpen={(l) => setAbiertoId(l.id)}
                leads={leadsFiltrados
                  .filter((l) => l.stageId === stage.id)
                  .sort((a, b) => a.position - b.position)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeLead ? (
              <LeadCard lead={activeLead} currency={currency} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {managing && (
        <StageManager
          stages={stages}
          onClose={() => setManaging(false)}
          onChanged={() => void refetch()}
        />
      )}

      {/* Va ANTES que los diálogos: con el mismo z-index, el que se pinta
          después queda encima, y el motivo de pérdida debe tapar al cajón. */}
      {abierto && (
        <LeadDrawer
          lead={abierto}
          stages={stages}
          currency={currency}
          onClose={() => setAbiertoId(null)}
          onMoveStage={(stageId) => moverDesdeCajon(abierto.id, stageId)}
          onAmount={(cents) => void guardarMonto(abierto.id, cents)}
          onPriority={(p) => void guardarPrioridad(abierto.id, p)}
        />
      )}

      {editandoMonto && (
        <AmountDialog
          leadName={editandoMonto.contact.name}
          currency={editandoMonto.currency ?? currency}
          amountCents={editandoMonto.amountCents}
          priority={editandoMonto.priority}
          onPriorityChange={(p) => {
            setEditandoMonto({ ...editandoMonto, priority: p });
            void guardarPrioridad(editandoMonto.id, p);
          }}
          onCancel={() => setEditandoMonto(null)}
          onSave={(cents) => {
            const leadId = editandoMonto.id;
            setEditandoMonto(null);
            void guardarMonto(leadId, cents);
          }}
        />
      )}

      {pendingLoss && (
        <LossReasonDialog
          leadName={pendingLoss.name}
          onCancel={() => setPendingLoss(null)}
          onConfirm={(reason, note) => {
            const { leadId, stageId } = pendingLoss;
            setPendingLoss(null);
            void moverLead(leadId, stageId, { reason, note });
          }}
        />
      )}
    </div>
  );
}

/**
 * Totales de una columna. Se calculan al pintar: un total guardado se
 * desincroniza en cuanto alguien mueve una tarjeta, y sumar unas decenas es
 * gratis. Todo en CENTAVOS enteros — el dinero jamás pasa por coma flotante.
 */
function totalesDeEtapa(leads: BoardLead[], businessCurrency: string) {
  let totalCents = 0;
  let sinMonto = 0;
  let otraMoneda = 0;

  for (const l of leads) {
    if (l.amountCents === null) {
      sinMonto++;
      continue;
    }
    if (!sumable({ amountCents: l.amountCents, currency: l.currency }, businessCurrency)) {
      otraMoneda++;
      continue;
    }
    totalCents += l.amountCents;
  }
  return { totalCents, sinMonto, otraMoneda };
}

function StageColumn({
  stage,
  leads,
  currency,
  onEditAmount,
  onOpen,
}: {
  stage: StageDto;
  leads: BoardLead[];
  currency: string;
  onEditAmount: (lead: BoardLead) => void;
  onOpen: (lead: BoardLead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-64 shrink-0 snap-start flex-col rounded-lg border border-border-strong bg-subtle transition-[box-shadow,border-color]",
        isOver && "border-brand ring-[3px] ring-brand-soft"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[13.5px] font-bold tracking-tight">
          {stage.kind === "won" && <Trophy className="h-3.5 w-3.5 text-primary" />}
          {stage.kind === "lost" && (
            <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {stage.name}
        </span>
        <span className="rounded-full border border-border-strong bg-background px-2 py-0.5 font-mono text-[11px] text-text-3">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {leads.map((lead) => (
          <DraggableLead
            key={lead.id}
            lead={lead}
            currency={currency}
            onEditAmount={onEditAmount}
            onOpen={onOpen}
          />
        ))}
      </div>
      <StageFooter leads={leads} currency={currency} />
    </div>
  );
}

/** Cuánto dinero hay en esta etapa, y qué quedó fuera de la cuenta. */
function StageFooter({ leads, currency }: { leads: BoardLead[]; currency: string }) {
  const { totalCents, sinMonto, otraMoneda } = totalesDeEtapa(leads, currency);
  const conMonto = leads.length - sinMonto - otraMoneda;

  return (
    <div className="border-t px-3 py-2 text-[11px]">
      {conMonto === 0 ? (
        // Un "$0.00" aquí se lee como un error del sistema, no como un dato.
        <p className="text-muted-foreground">Sin montos capturados</p>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-muted-foreground">
            Total{sinMonto > 0 ? ` · ${sinMonto} sin monto` : ""}
          </span>
          <span className="font-semibold tabular-nums">
            {formatMoneyCents(totalCents, currency)}
          </span>
        </div>
      )}
      {otraMoneda > 0 && (
        // Descartarlos en silencio haría que el total mintiera sin que nadie
        // pudiera notarlo.
        <p className="mt-0.5 text-warning-text">
          {otraMoneda} en otra moneda, fuera del total
        </p>
      )}
    </div>
  );
}

function DraggableLead({
  lead,
  currency,
  onEditAmount,
  onOpen,
}: {
  lead: BoardLead;
  currency: string;
  onEditAmount: (lead: BoardLead) => void;
  onOpen: (lead: BoardLead) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // Abrir y arrastrar conviven porque el sensor solo activa el arrastre a
      // los 6 px de movimiento: un clic quieto nunca llega a ser un arrastre.
      // Los controles de dentro de la tarjeta cortan la propagación, para que
      // tocar "+ monto" no abra además el cajón.
      onClick={() => onOpen(lead)}
      // dnd-kit ya deja el nodo con `role="button"` y `tabIndex`, pero un div
      // no dispara `click` con el teclado: sin esto, el cajón sería alcanzable
      // solo con el ratón.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead);
        }
      }}
      aria-label={`Abrir el trato de ${lead.contact.name}`}
      className={cn(isDragging && "opacity-40")}
    >
      <LeadCard lead={lead} currency={currency} onEditAmount={onEditAmount} />
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.477-.15-.678.15-.2.301-.778.98-.954 1.18-.176.2-.352.226-.653.075s-1.272-.469-2.423-1.496c-.896-.799-1.501-1.787-1.677-2.088-.176-.301-.019-.464.132-.614.135-.135.301-.352.452-.527.15-.176.2-.301.301-.502.101-.2.05-.377-.025-.527s-.678-1.634-.929-2.239c-.244-.589-.493-.509-.678-.519l-.578-.01c-.2 0-.527.075-.803.377s-1.054 1.03-1.054 2.511 1.079 2.912 1.23 3.113c.15.2 2.124 3.243 5.145 4.549.718.311 1.279.497 1.716.636.721.23 1.377.198 1.896.12.578-.088 1.78-.728 2.031-1.431.251-.703.251-1.305.176-1.431-.076-.126-.277-.201-.578-.352z" />
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.17L2 22l4.982-1.408A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.2c-1.616 0-3.123-.483-4.385-1.313l-.314-.199-3.254.92.934-3.17-.207-.329A8.163 8.163 0 013.8 12c0-4.521 3.679-8.2 8.2-8.2 4.521 0 8.2 3.679 8.2 8.2 0 4.521-3.679 8.2-8.2 8.2z" />
    </svg>
  );
}

function LeadCard({
  lead,
  currency,
  overlay = false,
  onEditAmount,
}: {
  lead: BoardLead;
  currency: string;
  overlay?: boolean;
  onEditAmount?: (lead: BoardLead) => void;
}) {
  const cleanPhone = lead.contact.phone ? lead.contact.phone.replace(/\D/g, "") : null;
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  return (
    <div
      className={cn(
        "group cursor-grab rounded-lg border border-border-strong bg-card p-3 shadow-sm transition-all hover:border-brand/40 hover:shadow-md",
        overlay && "rotate-2 shadow-pop ring-2 ring-brand"
      )}
    >
      <div className="flex items-start gap-2.5">
        <ContactAvatar name={lead.contact.name} seed={lead.contact.id} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-brand-text">
              {lead.contact.name}
            </p>
            {lead.priority && <PriorityBadge value={lead.priority} />}
          </div>

          {/* Teléfono formateado con WhatsApp estilo MiCierro */}
          {lead.contact.phone && (
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]"
                title="Contacto con WhatsApp"
              />
              <span className="truncate">{formatPhone(lead.contact.phone)}</span>
            </div>
          )}

          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {lead.lastActivityAt
              ? `Actividad: ${formatTime(lead.lastActivityAt)}`
              : "Sin actividad reciente"}
          </p>
        </div>
      </div>

      {/* Acciones directas al pie de la tarjeta */}
      {!overlay && (
        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-border/60 pt-2">
          <div className="flex items-center gap-1">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                title={`Abrir WhatsApp Web directo con ${lead.contact.name}`}
                className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <WhatsAppIcon className="h-3 w-3 fill-current" />
                <span>WA</span>
              </a>
            )}
            {lead.conversationId && (
              <Link
                href={`/inbox?contact=${lead.contact.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                title="Abrir conversación en CRM"
                className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <MessageSquareText className="h-3 w-3" />
                <span>Chat</span>
              </Link>
            )}
          </div>

          {onEditAmount && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onEditAmount(lead);
              }}
              className={cn(
                "rounded px-1.5 py-0.5 text-right text-xs tabular-nums transition-colors hover:bg-accent",
                lead.amountCents === null
                  ? "text-text-3 font-normal"
                  : "font-semibold text-foreground"
              )}
            >
              {lead.amountCents === null
                ? "+ monto"
                : formatMoneyCents(lead.amountCents, lead.currency ?? currency)}
            </button>
          )}
        </div>
      )}

      {overlay && lead.amountCents !== null && (
        <p className="mt-2 border-t pt-1.5 text-right text-xs font-semibold tabular-nums">
          {formatMoneyCents(lead.amountCents, lead.currency ?? currency)}
        </p>
      )}
    </div>
  );
}
