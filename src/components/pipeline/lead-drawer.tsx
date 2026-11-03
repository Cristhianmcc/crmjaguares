"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText, X } from "lucide-react";
import type {
  AnuncioDto,
  FichaDto,
  FichaValue,
  PriorityValue,
  StageDto,
} from "@/lib/types";
import { formatMoneyCents, parseMoneyToCents } from "@/lib/money";
import { cn, formatPhone } from "@/lib/utils";
import { AnuncioOrigen } from "@/components/anuncio-origen";
import { ContactAvatar } from "@/components/avatar";
import { FichaPanel } from "@/components/ficha-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityPicker } from "./priority-picker";
import type { BoardLead } from "./pipeline-client";

/**
 * El trato, abierto, sin salir del tablero.
 *
 * Antes el clic en una tarjeta no hacía nada: para ver de quién era había que
 * irse a la bandeja y volver, y revisando una columna de quince eso son treinta
 * viajes. El cajón contesta la pregunta "¿quién es y cómo va?" en el sitio
 * donde uno la hace.
 */
export function LeadDrawer({
  lead,
  stages,
  currency,
  onClose,
  onMoveStage,
  onAmount,
  onPriority,
}: {
  lead: BoardLead;
  stages: StageDto[];
  /** Moneda del negocio, para el lead que aún no tiene la suya. */
  currency: string;
  onClose: () => void;
  /** Pasa por el mismo camino que el arrastre: perder exige motivo. */
  onMoveStage: (stageId: string) => void;
  onAmount: (cents: number | null) => void;
  onPriority: (value: PriorityValue | null) => void;
}) {
  const [ficha, setFicha] = useState<FichaDto>({});
  // 018: de qué anuncio llegó; null si escribió por su cuenta.
  const [anuncio, setAnuncio] = useState<AnuncioDto | null>(null);
  const [monto, setMonto] = useState("");
  const [editandoMonto, setEditandoMonto] = useState(false);

  const contactId = lead.contact.id;
  const moneda = lead.currency ?? currency;
  const cleanPhone = lead.contact.phone ? lead.contact.phone.replace(/\D/g, "") : null;
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  const cargarFicha = useCallback(async () => {
    const detail = await fetch(`/api/contacts/${contactId}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setFicha(detail?.contact?.ficha ?? {});
    setAnuncio(detail?.anuncio ?? null);
  }, [contactId]);

  // Al abrir otro trato no puede asomarse el anuncio del anterior.
  useEffect(() => setAnuncio(null), [contactId]);

  useEffect(() => {
    setEditandoMonto(false);
    setMonto(lead.amountCents === null ? "" : (lead.amountCents / 100).toFixed(2));
    void cargarFicha();
  }, [cargarFicha, lead.amountCents]);

  // Escape cierra: un cajón que solo se cierra con el ratón estorba a quien
  // revisa el tablero con el teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function guardarFicha(patch: Record<string, FichaValue | null>) {
    setFicha((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) delete next[k];
        else next[k] = v;
      }
      return next;
    });
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ficha: patch }),
    }).catch(() => null);
    void cargarFicha();
  }

  const montoParseado = monto.trim() ? parseMoneyToCents(monto) : null;
  const montoInvalido = monto.trim().length > 0 && montoParseado === null;

  return (
    <>
      {/* Velo: cerrar tocando fuera es lo que uno intenta primero. */}
      <button
        aria-label="Cerrar el trato"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-overlay"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Trato de ${lead.contact.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(360px,92vw)] flex-col border-l bg-popover shadow-pop"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="kicker text-text-2">
            Trato
          </h3>
          <button
            onClick={onClose}
            aria-label="Cerrar el panel del trato"
            className="rounded p-1 text-text-3 hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Quién */}
          <section className="border-b p-4">
            <div className="flex items-center gap-3">
              <ContactAvatar
                name={lead.contact.name}
                seed={lead.contact.id}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-[650]">{lead.contact.name}</p>
                <p className="text-xs text-text-3">
                  {formatPhone(lead.contact.phone)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {lead.conversationId ? (
                <Link
                  href={`/inbox?contact=${lead.contact.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-md border bg-secondary px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <MessageSquareText className="h-4 w-4" /> Abrir conversación en CRM
                </Link>
              ) : (
                <p className="text-xs text-text-3">
                  Todavía no hay conversación registrada en CRM.
                </p>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <WhatsAppIcon className="h-4 w-4 fill-current" /> Abrir en WhatsApp Web / App
                </a>
              )}
            </div>

            {anuncio && (
              <div className="mt-3">
                <AnuncioOrigen anuncio={anuncio} />
              </div>
            )}
          </section>

          {/* Cuánto */}
          <section className="border-b p-4">
            <p className="mb-2 kicker">
              Monto ({moneda})
            </p>
            {editandoMonto ? (
              <>
                <Input
                  autoFocus
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !montoInvalido) {
                      setEditandoMonto(false);
                      onAmount(montoParseado);
                    }
                    if (e.key === "Escape") setEditandoMonto(false);
                  }}
                  placeholder="12,500"
                  aria-label="Monto del trato"
                  className="h-8 text-sm"
                />
                <p className="mt-1 text-xs text-text-3">
                  {montoInvalido
                    ? "No se entiende ese importe."
                    : montoParseado === null
                      ? "Déjalo vacío para quitar el monto."
                      : `Se guardará como ${formatMoneyCents(montoParseado, moneda)}`}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={montoInvalido}
                    onClick={() => {
                      setEditandoMonto(false);
                      onAmount(montoParseado);
                    }}
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditandoMonto(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setEditandoMonto(true)}
                aria-label="Editar el monto"
                className={cn(
                  "w-full rounded px-1 py-1 text-left text-sm tabular-nums hover:bg-accent",
                  lead.amountCents === null
                    ? "text-text-3"
                    : "font-semibold text-foreground"
                )}
              >
                {lead.amountCents === null
                  ? "Sin monto — captúralo"
                  : formatMoneyCents(lead.amountCents, moneda)}
              </button>
            )}
          </section>

          {/* A quién llamar primero */}
          <section className="border-b p-4">
            <p className="mb-2 kicker">
              Prioridad
            </p>
            <PriorityPicker value={lead.priority} onChange={onPriority} />
          </section>

          {/* Dónde va */}
          <section className="border-b p-4">
            <p className="mb-2 kicker">
              Etapa
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((s) => {
                const actual = s.id === lead.stageId;
                return (
                  <button
                    key={s.id}
                    onClick={() => !actual && onMoveStage(s.id)}
                    aria-pressed={actual}
                    aria-label={`Mover a ${s.name}`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      actual
                        ? "border-brand bg-brand-tint font-semibold text-brand-text"
                        : "border-border text-text-2 hover:bg-accent"
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Qué se sabe */}
          <FichaPanel ficha={ficha} onSave={guardarFicha} />
        </div>
      </aside>
    </>
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
