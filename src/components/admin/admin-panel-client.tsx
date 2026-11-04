"use client";

import { useState, useEffect, useCallback } from "react";
import { PLANES, type PlanId } from "@/lib/planes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface OrgItem {
  id: string;
  name: string;
  plan: PlanId;
  createdAt: string;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
}

export function AdminPanelClient() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdData, setCreatedData] = useState<{
    businessName: string;
    clientName: string;
    email: string;
    password: string;
    planNombre: string;
  } | null>(null);

  // Formulario de creación
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("trial");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orgs");
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrgs();
  }, [fetchOrgs]);

  function generatePassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/orgs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          businessName,
          email,
          password,
          plan: selectedPlan,
          durationDays: selectedPlan === "trial" ? 14 : 30,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear la cuenta.");
      }

      setCreatedData({
        businessName,
        clientName,
        email,
        password,
        planNombre: PLANES[selectedPlan].nombre,
      });

      // Limpiar formulario y recargar
      setClientName("");
      setBusinessName("");
      setEmail("");
      setPassword("");
      setSelectedPlan("trial");
      setShowCreateModal(false);
      void fetchOrgs();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePlanChange(orgId: string, newPlan: PlanId) {
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) {
        void fetchOrgs();
      }
    } catch {
      // ignore
    }
  }

  async function handleExtend30Days(orgId: string, currentPlan: PlanId) {
    const planToSet = currentPlan === "trial" ? "basico" : currentPlan;
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planToSet, durationDays: 30 }),
      });
      if (res.ok) {
        setNoticeModal({ title: "Suscripción Extendida", message: "Se han añadido exitosamente +30 días de servicio al negocio." });
        void fetchOrgs();
      }
    } catch {
      // ignore
    }
  }

  const whatsappMessage = createdData
    ? `¡Hola ${createdData.clientName}! Tu cuenta en el CRM de WhatsApp ya está lista:\n\n` +
      `🏢 Negocio: ${createdData.businessName}\n` +
      `🌐 Acceso: ${window.location.origin}\n` +
      `📧 Usuario: ${createdData.email}\n` +
      `🔑 Contraseña: ${createdData.password}\n` +
      `📊 Plan: ${createdData.planNombre}\n\n` +
      `Inicia sesión para conectar tu WhatsApp y comenzar a responder a tus clientes.`
    : "";

  function copyWhatsApp() {
    if (!whatsappMessage) return;
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // Métricas
  const totalOrgs = orgs.length;
  const trials = orgs.filter((o) => o.plan === "trial").length;
  const basicos = orgs.filter((o) => o.plan === "basico").length;
  const pros = orgs.filter((o) => o.plan === "pro").length;

  return (
    <div className="space-y-6">
      {/* Barra superior con métricas y botón de creación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administración de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Crea cuentas llave en mano para tus clientes, administra sus planes y vigencias.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 font-semibold">
          <span>+</span>
          <span>Crear Nueva Cuenta de Cliente</span>
        </Button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Negocios</p>
          <p className="text-2xl font-bold">{totalOrgs}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Prueba Gratuita</p>
          <p className="text-2xl font-bold text-amber-600">{trials}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Plan Básico (S/ 79)</p>
          <p className="text-2xl font-bold text-blue-600">{basicos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Plan Pro (S/ 109)</p>
          <p className="text-2xl font-bold text-emerald-600">{pros}</p>
        </Card>
      </div>

      {/* Modal emergente vistoso de confirmación de cuenta creada para WhatsApp */}
      {createdData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <Card className="w-full max-w-lg shadow-2xl border-emerald-500/40 bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-emerald-600 flex items-center gap-2 font-bold">
                  <span>🎉</span>
                  <span>¡Cuenta de {createdData.businessName} Lista!</span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCreatedData(null)}>
                  ✕
                </Button>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                La cuenta ya fue creada. Copia este mensaje y pégalo directamente en WhatsApp para tu cliente:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="p-3.5 bg-muted/60 rounded-lg border text-xs whitespace-pre-wrap font-mono select-all leading-relaxed">
                {whatsappMessage}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyWhatsApp}
                  variant="default"
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 shadow-sm"
                >
                  <span>{copied ? "✓ ¡Mensaje Copiado al Portapapeles!" : "📋 Copiar mensaje para WhatsApp"}</span>
                </Button>
                <Button variant="outline" onClick={() => setCreatedData(null)}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal vistoso de confirmación para acciones (como +30 días) */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <Card className="w-full max-w-sm shadow-2xl border-emerald-500/30 text-center p-6 space-y-4 bg-card">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">{noticeModal.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{noticeModal.message}</p>
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
              onClick={() => setNoticeModal(null)}
            >
              Entendido
            </Button>
          </Card>
        </div>
      )}

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg shadow-xl animate-in fade-in-50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Crear Cuenta para Cliente</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  ✕
                </Button>
              </div>
              <CardDescription>
                Habilita al cliente al instante. El sistema creará su usuario, su organización y su embudo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="clientName">Nombre del Responsable / Contacto</Label>
                  <Input
                    id="clientName"
                    required
                    placeholder="Ej: Carlos Ramos"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="businessName">Nombre del Negocio / Colegio</Label>
                  <Input
                    id="businessName"
                    required
                    placeholder="Ej: Colegio San Agustín"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Correo del Cliente (Usuario de acceso)</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="director@sanagustin.edu.pe"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Contraseña inicial</Label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-xs text-primary underline hover:no-underline"
                    >
                      Generar aleatoria
                    </button>
                  </div>
                  <Input
                    id="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="plan">Plan inicial</Label>
                  <select
                    id="plan"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as PlanId)}
                  >
                    <option value="trial">Prueba Gratuita (14 días)</option>
                    <option value="basico">Plan Básico — S/ 79/mes (30 días)</option>
                    <option value="pro">Plan Pro — S/ 109/mes (30 días)</option>
                    <option value="agencia">Plan Agencia — S/ 249/mes</option>
                  </select>
                </div>

                {formError && <p className="text-xs text-destructive">{formError}</p>}

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creando…" : "Crear y Habilitar Cliente"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla de organizaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Clientes Registrados ({orgs.length})</CardTitle>
          <CardDescription>
            Puedes cambiar el plan de cualquier cliente o añadirle +30 días con un clic.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-4 text-left">Negocio</th>
                  <th className="py-3 px-4 text-left">Dueño / Correo</th>
                  <th className="py-3 px-4 text-left">Plan Actual</th>
                  <th className="py-3 px-4 text-left">Vigencia / Vencimiento</th>
                  <th className="py-3 px-4 text-left">Creado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Cargando clientes…
                    </td>
                  </tr>
                ) : orgs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay negocios registrados aún.
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => {
                    const isTrial = org.plan === "trial";
                    const expires = org.planExpiresAt || org.trialEndsAt;
                    const fechaExp = expires
                      ? new Date(expires).toLocaleDateString("es-PE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Sin fecha";

                    return (
                      <tr key={org.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {org.name}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="font-medium text-foreground">{org.ownerName}</p>
                          <p className="text-muted-foreground">{org.ownerEmail}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="text-xs rounded border bg-background px-2 py-1 font-medium"
                            value={org.plan}
                            onChange={(e) => void handlePlanChange(org.id, e.target.value as PlanId)}
                          >
                            <option value="trial">Prueba (Gratis)</option>
                            <option value="basico">Básico (S/ 79)</option>
                            <option value="pro">Pro (S/ 109)</option>
                            <option value="agencia">Agencia</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={isTrial ? "outline" : "default"} className="text-[10px]">
                              {isTrial ? "Trial" : "Pagado"}
                            </Badge>
                            <span className="text-muted-foreground">{fechaExp}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString("es-PE")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => void handleExtend30Days(org.id, org.plan)}
                          >
                            <span>+30 días</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

