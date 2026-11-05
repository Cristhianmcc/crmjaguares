"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, Trash2, Upload } from "lucide-react";
import type { RubroPresetId } from "@/lib/rubro-presets";
import { BrainStatusCard } from "@/components/agent/brain-status-card";
import { PresetConfirmDialog, RoleConfirmDialog } from "@/components/agent/preset-confirm-dialog";
import { externalDown, type BrainStatusDto } from "@/lib/brain-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  HERRAMIENTAS,
  ROLES,
  type ClaveHerramienta,
} from "@/lib/agent-roles";

type Profile = {
  enabled: boolean;
  name: string;
  tone: string | null;
  instructions: string | null;
  escalationRules: string | null;
  greeting: string | null;
  /** 034 */
  role: string;
  tools: ClaveHerramienta[];
};

type KbEntry = {
  id: string;
  kind: "qa" | "block";
  question: string | null;
  answer: string | null;
  content: string | null;
};

export function AgentClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [aiMensaje, setAiMensaje] = useState<string | null>(null);
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [kbSize, setKbSize] = useState<{ chars: number; warnAt: number; warning: boolean } | null>(null);
  const [saved, setSaved] = useState(false);
  // 036 — Por qué no se pudo encender (409 `sin_cerebro`): el mensaje del
  // servidor, tal cual, junto al interruptor.
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [agendaEnabled, setAgendaEnabled] = useState(false);
  // «Quién responde»: se refresca solo, porque la última llamada del cerebro
  // externo y su /health cambian sin que nadie toque esta pantalla.
  const [brain, setBrain] = useState<BrainStatusDto | null>(null);
  const [confirmRole, setConfirmRole] = useState(false);

  const loadBrain = useCallback(async () => {
    const b = await fetch("/api/agent/brain-status")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setBrain(b);
  }, []);

  const refetch = useCallback(async () => {
    const [p, kb, size] = await Promise.all([
      fetch("/api/agent/profile").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/kb").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/kb/size").then((r) => (r.ok ? r.json() : null)),
      loadBrain(),
    ]).catch(() => [null, null, null]);
    if (p) {
      setProfile(p.profile);
      setAiConfigured(p.aiConfigured);
      setAiMensaje(p.aiMensaje ?? null);
      setAgendaEnabled(p.agendaEnabled === true);
    }
    if (kb) setEntries(kb.entries);
    if (size) setKbSize(size);
  }, [loadBrain]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const id = setInterval(() => void loadBrain(), 30_000);
    return () => clearInterval(id);
  }, [loadBrain]);

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  async function executeRolePreset() {
    await fetch("/api/agent/profile/preset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "calificador" }),
    }).catch(() => null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setConfirmRole(false);
    void refetch();
  }

  async function saveProfile(patch: Partial<Profile>): Promise<boolean> {
    const res = await fetch("/api/agent/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (patch.enabled !== undefined) {
        setSwitchError(
          data?.error?.message ??
            (patch.enabled ? "No se pudo encender el agente." : "No se pudo apagar el agente.")
        );
      }
      void refetch();
      return false;
    }
    if (patch.enabled !== undefined) setSwitchError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    void refetch();
    return true;
  }

  // 036 — El interruptor solo se enciende con un agente conectado (el
  // servidor lo exige igual: 409 `sin_cerebro`). Apagarlo se puede siempre:
  // un perfil que quedó encendido sin cerebro no debe quedarse atrapado.
  const brainConnected = brain?.dispatch.active === true || aiConfigured;
  const switchDisabled = !profile.enabled && !aiConfigured && !brainConnected;

  // 036 — Sin llave de IA el agente conectado no tiene con qué pensar (piensa
  // por el CRM, `/api/bot/llm`). Sin agente conectado no hace falta pedirla:
  // la bandeja manual no la usa. Con el agente caído ya lo dice la tarjeta.
  const aiCallout =
    !aiConfigured && brainConnected && brain && !externalDown(brain);

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[17px] font-bold tracking-tight">Agente de IA</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-primary">Guardado ✓</span>}
          <span className="text-sm text-muted-foreground">
            {profile.enabled ? "Encendido" : "Apagado"}
          </span>
          {/* El interruptor compartido (#53): el pomo propio de aquí era
              `absolute` sin `left`, arrancaba del centro de la pista y
              encendido quedaba afuera. */}
          {/* Encender exige IA; APAGAR se puede siempre. Con la llave pausada
              (#85) el agente sigue «encendido» sin poder pensar, y un
              interruptor bloqueado dejaría al dueño sin forma de callarlo. */}
          <Switch
            checked={profile.enabled}
            disabled={switchDisabled}
            label="Agente encendido"
            onCheckedChange={(enabled) => void saveProfile({ enabled })}
          />
        </div>
        {(switchError || switchDisabled) && (
          <p
            role={switchError ? "alert" : undefined}
            className={
              switchError
                ? "w-full text-right text-xs text-danger-text"
                : "w-full text-right text-xs text-muted-foreground"
            }
          >
            {switchError ?? (switchDisabled ? "Se enciende cuando conectes tu agente o configures la IA." : "")}
          </p>
        )}
      </header>

      {brain && (
        <div className="mx-4 mt-4 sm:mx-6 sm:mt-6">
          <BrainStatusCard status={brain} agentName={profile.name} />
        </div>
      )}

      {aiCallout && (
        <div className="mx-4 mt-4 rounded-lg border border-brand-soft bg-brand-tint p-5 text-center sm:mx-6 sm:mt-6 sm:p-6">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-medium">
            {aiMensaje ? "Tu agente no puede pensar" : "Tu agente no tiene con qué pensar"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {aiMensaje ??
              "Piensa a través del CRM con la llave de Ajustes → IA: elige el proveedor, el modelo y pega tu llave, sin reiniciar nada."}{" "}
            (Si tu agente usa su propia llave, puedes ignorar este aviso.)
          </p>
          <Link
            href="/settings/ai"
            className="mt-3 inline-block text-sm font-medium text-brand-text underline underline-offset-2"
          >
            Ir a Ajustes → IA →
          </Link>
        </div>
      )}

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-2">
        <RolSection
          profile={profile}
          agendaEnabled={agendaEnabled}
          onTools={(tools) => void saveProfile({ tools })}
          onPreset={() => setConfirmRole(true)}
        />
        <ProfileSection profile={profile} onSave={saveProfile} />
        <KbSection entries={entries} kbSize={kbSize} onChanged={() => void refetch()} />
      </div>

      {confirmRole && (
        <RoleConfirmDialog
          roleLabel={ROLES.calificador.etiqueta}
          onCancel={() => setConfirmRole(false)}
          onConfirm={executeRolePreset}
        />
      )}
    </div>
  );
}

/**
 * 034 — El rol y sus herramientas. Las respeta el agente conectado (Nea); el
 * CRM se las entrega en su perfil (`/api/bot/profile`).
 */
function RolSection({
  profile,
  agendaEnabled,
  onTools,
  onPreset,
}: {
  profile: Profile;
  agendaEnabled: boolean;
  onTools: (tools: ClaveHerramienta[]) => void;
  onPreset: () => void;
}) {
  const rol = ROLES[profile.role as keyof typeof ROLES] ?? ROLES.calificador;
  const visibles = HERRAMIENTAS.filter((h) => !h.agenda || agendaEnabled);
  const encendida = (clave: ClaveHerramienta) => profile.tools.includes(clave);
  function cambiar(clave: ClaveHerramienta, on: boolean) {
    const siguiente = on
      ? [...profile.tools, clave]
      : profile.tools.filter((t) => t !== clave);
    onTools(siguiente);
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>
              Rol: {rol.etiqueta}
            </CardTitle>
            <CardDescription>{rol.descripcion}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onPreset}>
            Cargar el rol {rol.etiqueta}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((h) => (
            <li key={h.clave} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{h.etiqueta}</p>
                <p className="text-xs text-muted-foreground">{h.descripcion}</p>
              </div>
              <Switch
                checked={h.fija ? true : encendida(h.clave)}
                disabled={h.fija === true}
                label={h.etiqueta}
                onCheckedChange={(on) => cambiar(h.clave, on)}
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          El agente toma los cambios en unos minutos, sin redesplegar nada.
        </p>
      </CardContent>
    </Card>
  );
}

function ProfileSection({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => Promise<boolean>;
}) {
  const [form, setForm] = useState(profile);
  useEffect(() => setForm(profile), [profile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comportamiento</CardTitle>
        <CardDescription>
          Cómo se presenta y actúa el agente al responder a tus clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="agent-name">Nombre del agente</Label>
          <Input
            id="agent-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent-tone">Tono</Label>
          <Input
            id="agent-tone"
            placeholder="p. ej. cercano y directo, con usted"
            value={form.tone ?? ""}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent-instructions">Instrucciones</Label>
          <Textarea
            id="agent-instructions"
            rows={5}
            placeholder="Qué debe y no debe hacer el agente…"
            value={form.instructions ?? ""}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent-escalation">Reglas de escalado</Label>
          <Textarea
            id="agent-escalation"
            rows={3}
            placeholder="Cuándo pasar la conversación a un humano…"
            value={form.escalationRules ?? ""}
            onChange={(e) => setForm({ ...form, escalationRules: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="agent-greeting">Saludo</Label>
          <Input
            id="agent-greeting"
            placeholder="Saludo para conversaciones nuevas"
            value={form.greeting ?? ""}
            onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          />
        </div>
        <Button
          onClick={() => {
            // 034 — Solo lo de esta tarjeta: el formulario guarda una copia
            // del perfil de cuando se abrió, y mandarla entera pisaría las
            // herramientas cambiadas después en la tarjeta del rol.
            const { name, tone, instructions, escalationRules, greeting } = form;
            void onSave({ name, tone, instructions, escalationRules, greeting });
          }}
        >
          Guardar comportamiento
        </Button>
      </CardContent>
    </Card>
  );
}

function KbSection({
  entries,
  kbSize,
  onChanged,
}: {
  entries: KbEntry[];
  kbSize: { chars: number; warnAt: number; warning: boolean } | null;
  onChanged: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [block, setBlock] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<RubroPresetId>("dental");
  const [confirmPreset, setConfirmPreset] = useState<RubroPresetId | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function executeLoadPreset(replaceKb: boolean) {
    if (!confirmPreset) return;
    try {
      const res = await fetch("/api/agent/preset-rubro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presetId: confirmPreset, replaceKb }),
      });
      if (res.ok) {
        onChanged();
      }
    } finally {
      setConfirmPreset(null);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        setBlock((prev) => (prev ? `${prev}\n\n${text}` : text));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function addQa() {
    if (!question.trim() || !answer.trim()) return;
    await fetch("/api/kb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "qa", question, answer }),
    }).catch(() => null);
    setQuestion("");
    setAnswer("");
    onChanged();
  }

  async function addBlock() {
    if (!block.trim()) return;
    await fetch("/api/kb", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "block", content: block }),
    }).catch(() => null);
    setBlock("");
    onChanged();
  }

  async function remove(id: string) {
    await fetch(`/api/kb/${id}`, { method: "DELETE" }).catch(() => null);
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Base de Conocimiento (Entrenamiento de la IA)</CardTitle>
            <CardDescription>
              La fuente de verdad de tu bot: la IA responderá las dudas de tus clientes basándose fielmente en lo que agregues aquí.
            </CardDescription>
          </div>
          {kbSize && (
            <Badge variant={kbSize.warning ? "warning" : "secondary"}>
              {kbSize.chars.toLocaleString("es-MX")} caracteres
            </Badge>
          )}
        </div>
        {kbSize?.warning && (
          <p className="text-xs text-warning-text">
            El conocimiento se acerca al límite de memoria del modelo. Considera resumir o depurar entradas muy extensas.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-soft bg-brand-tint/40 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span>Plantillas por rubro:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value as RubroPresetId)}
              className="h-8 rounded border bg-background px-2 text-xs"
            >
              <option value="dental">Clínica Dental / Odontología</option>
              <option value="servicios">Servicios / Citas / Estética</option>
              <option value="escuela">Escuela Deportiva / Talleres</option>
              <option value="comercio">Comercio / Tienda</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => setConfirmPreset(selectedPreset)}
            >
              Cargar plantilla
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Nuevo bloque de texto libre</p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                className="hidden"
                id="kb-file-input"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="kb-file-input"
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Importar archivo (.txt, .md)</span>
              </label>
            </div>
          </div>
          <Textarea
            placeholder="Pega aquí servicios, precios, tratamientos, dirección o información de folletos/PDFs…"
            rows={4}
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
          <Button size="sm" onClick={() => void addBlock()} disabled={!block.trim()}>
            <Plus className="h-4 w-4" /> Agregar bloque al conocimiento
          </Button>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-medium">Nueva pregunta frecuente (P/R)</p>
          <Input
            placeholder="Pregunta (p. ej. ¿Cuánto cuesta la curación dental?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Textarea
            placeholder="Respuesta (p. ej. La curación con resina cuesta S/ 100 e incluye evaluación inicial.)"
            rows={2}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => void addQa()}
            disabled={!question.trim() || !answer.trim()}
          >
            <Plus className="h-4 w-4" /> Agregar pregunta y respuesta
          </Button>
        </div>

        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 rounded-md border p-3">
              <div className="min-w-0 flex-1 text-sm">
                {e.kind === "qa" ? (
                  <>
                    <p className="font-medium">{e.question}</p>
                    <p className="mt-0.5 text-muted-foreground">{e.answer}</p>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-muted-foreground">{e.content}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Eliminar entrada"
                onClick={() => void remove(e.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {entries.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Sin información todavía: agrega los servicios y respuestas clave de tu negocio.
            </p>
          )}
        </ul>
      </CardContent>

      {confirmPreset && (
        <PresetConfirmDialog
          presetId={confirmPreset}
          onCancel={() => setConfirmPreset(null)}
          onConfirm={executeLoadPreset}
        />
      )}
    </Card>
  );
}
