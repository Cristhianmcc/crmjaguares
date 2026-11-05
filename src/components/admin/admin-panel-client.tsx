"use client";

import { useState, useEffect, useCallback } from "react";
import { PLANES, type PlanId } from "@/lib/planes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type RubroId = "servicios" | "escuela" | "comercio";

interface OrgItem {
  id: string;
  name: string;
  plan: PlanId;
  rubro?: string;
  createdAt: string;
  trialEndsAt: string | null;
  planExpiresAt: string | null;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
  isCurrentOrg?: boolean;
}

export function AdminPanelClient() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orgToSuspend, setOrgToSuspend] = useState<OrgItem | null>(null);
  const [orgToDelete, setOrgToDelete] = useState<OrgItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [createdData, setCreatedData] = useState<{
    businessName: string;
    clientName: string;
    email: string;
    password: string;
    planNombre: string;
    rubro: string;
  } | null>(null);

  // Formulario de creación
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("trial");
  const [selectedRubro, setSelectedRubro] = useState<RubroId>("servicios");
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

  function isOrgActive(org: OrgItem): boolean {
    if (org.plan === "trial") {
      if (!org.trialEndsAt) return true;
      return new Date() < new Date(org.trialEndsAt);
    }
    if (org.planExpiresAt) {
      return new Date() < new Date(org.planExpiresAt);
    }
    return true;
  }

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
          rubro: selectedRubro,
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
        rubro: selectedRubro,
      });

      // Limpiar formulario y recargar
      setClientName("");
      setBusinessName("");
      setEmail("");
      setPassword("");
      setSelectedPlan("trial");
      setSelectedRubro("servicios");
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
        body: JSON.stringify({ plan: newPlan, durationDays: 30 }),
      });
      if (res.ok) {
        setNoticeModal({
          title: "Plan actualizado",
          message: `El plan del cliente ha sido cambiado a ${PLANES[newPlan].nombre}.`,
        });
        void fetchOrgs();
      }
    } catch {
      // ignore
    }
  }

  async function handleRubroChange(orgId: string, newRubro: string) {
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/rubro`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubro: newRubro }),
      });
      if (res.ok) {
        setNoticeModal({
          title: "Módulo / Rubro actualizado",
          message: `El negocio ahora tiene activo el módulo de ${
            newRubro === "servicios"
              ? "Citas y Calendario interactivo"
              : newRubro === "escuela"
              ? "Malla de Cupos de Escuela"
              : "Comercio General"
          }.`,
        });
        void fetchOrgs();
      }
    } catch {
      // ignore
    }
  }

  async function handleExtend(orgId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo extender la suscripción.");
      }
      setNoticeModal({
        title: "Suscripción extendida",
        message: "Se han añadido exitosamente +30 días de vigencia al negocio.",
      });
      void fetchOrgs();
    } catch (err) {
      setNoticeModal({
        title: "Error",
        message: err instanceof Error ? err.message : "Error al extender suscripción",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSuspend(org: OrgItem) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo suspender la cuenta.");
      }
      setOrgToSuspend(null);
      setNoticeModal({
        title: "Cuenta suspendida",
        message: `El acceso de ${org.name} ha sido pausado. Su agente dejará de contestar y verá la pantalla de pago al ingresar.`,
      });
      void fetchOrgs();
    } catch (err) {
      setNoticeModal({
        title: "Error",
        message: err instanceof Error ? err.message : "Error al suspender cuenta",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate(orgId: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo reactivar la cuenta.");
      }
      setNoticeModal({
        title: "Cuenta reactivada",
        message: "El negocio ha sido reactivado exitosamente con +30 días de servicio.",
      });
      void fetchOrgs();
    } catch (err) {
      setNoticeModal({
        title: "Error",
        message: err instanceof Error ? err.message : "Error al reactivar cuenta",
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(org: OrgItem) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar la cuenta.");
      }
      setOrgToDelete(null);
      setNoticeModal({
        title: "Cliente eliminado",
        message: `La organización ${org.name} y sus credenciales asociadas han sido eliminadas permanentemente.`,
      });
      void fetchOrgs();
    } catch (err) {
      setNoticeModal({
        title: "Error",
        message: err instanceof Error ? err.message : "Error al eliminar cliente",
      });
    } finally {
      setActionLoading(false);
    }
  }

  const moduloTexto =
    createdData?.rubro === "servicios"
      ? "Módulo: Citas, Calendario interactivo y agendamiento con IA\n"
      : createdData?.rubro === "escuela"
      ? "Módulo: Malla de Cupos y horarios por categoría\n"
      : "";

  const whatsappMessage = createdData
    ? `¡Hola ${createdData.clientName}! Tu cuenta en el CRM de WhatsApp ya está lista:\n\n` +
      `Negocio: ${createdData.businessName}\n` +
      `Acceso: ${typeof window !== "undefined" ? window.location.origin : "https://crm.jaguarescar.com"}\n` +
      `Usuario: ${createdData.email}\n` +
      `Contraseña: ${createdData.password}\n` +
      `Plan: ${createdData.planNombre}\n` +
      moduloTexto +
      `\nInicia sesión para conectar tu WhatsApp y comenzar a responder a tus clientes.`
    : "";

  function copyWhatsApp() {
    if (!whatsappMessage) return;
    navigator.clipboard.writeText(whatsappMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // Métricas
  const totalOrgs = orgs.length;
  const activos = orgs.filter((o) => isOrgActive(o)).length;
  const suspendidos = orgs.filter((o) => !isOrgActive(o)).length;
  const trials = orgs.filter((o) => o.plan === "trial" && isOrgActive(o)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Administración de Clientes
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea cuentas llave en mano para tus clientes, administra sus planes, suspende o reactiva sus servicios.
          </p>
        </div>
        <Button
          onClick={() => {
            generatePassword();
            setShowCreateModal(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
        >
          + Crear Nueva Cuenta de Cliente
        </Button>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Negocios</p>
          <p className="text-2xl font-bold text-foreground">{totalOrgs}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Activos / Pagados</p>
          <p className="text-2xl font-bold text-emerald-600">{activos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Suspendidos / Vencidos</p>
          <p className="text-2xl font-bold text-destructive">{suspendidos}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">En Prueba Gratuita</p>
          <p className="text-2xl font-bold text-amber-600">{trials}</p>
        </Card>
      </div>

      {/* Modal de confirmación de cuenta creada para WhatsApp */}
      {createdData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <Card className="w-full max-w-lg shadow-xl border-border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">
                  Cuenta de {createdData.businessName} lista
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
                  className="flex-1 text-xs h-9 font-medium"
                >
                  {copied ? "Mensaje copiado al portapapeles" : "Copiar mensaje para WhatsApp"}
                </Button>
                <Button variant="outline" className="text-xs h-9" onClick={() => setCreatedData(null)}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de aviso/éxito */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <Card className="w-full max-w-sm shadow-xl border-border text-center p-6 space-y-4 bg-card">
            <div>
              <h3 className="font-semibold text-base text-foreground">{noticeModal.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{noticeModal.message}</p>
            </div>
            <Button
              className="w-full text-xs h-9 font-medium"
              onClick={() => setNoticeModal(null)}
            >
              Entendido
            </Button>
          </Card>
        </div>
      )}

      {/* Modal de confirmación para Suspender */}
      {orgToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <Card className="w-full max-w-md shadow-xl border-border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">
                  Suspender cuenta de cliente
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrgToSuspend(null)}
                  disabled={actionLoading}
                >
                  ✕
                </Button>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Pausará el acceso de forma inmediata sin borrar ningún dato del negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-sm text-foreground">
                ¿Estás seguro de suspender a <strong>{orgToSuspend.name}</strong> ({orgToSuspend.ownerEmail})?
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>El agente de IA detendrá su atención automática de inmediato.</li>
                <li>Los usuarios verán la pantalla de pago al ingresar al CRM.</li>
                <li>Podrás reactivar el negocio en cualquier momento con un solo clic.</li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="text-xs h-9"
                  onClick={() => setOrgToSuspend(null)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="text-xs h-9 font-medium"
                  onClick={() => void handleSuspend(orgToSuspend)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Suspendiendo…" : "Suspender Cuenta"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de confirmación para Eliminar permanentemente */}
      {orgToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <Card className="w-full max-w-md shadow-xl border-border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-destructive">
                  Eliminar cliente permanentemente
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrgToDelete(null)}
                  disabled={actionLoading}
                >
                  ✕
                </Button>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Esta acción es irreversible y eliminará todos los datos del negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <p className="text-sm text-foreground">
                ¿Deseas eliminar permanentemente a <strong>{orgToDelete.name}</strong>?
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>Se borrarán todos sus contactos, mensajes y campañas de WhatsApp.</li>
                <li>Se revocarán los accesos y credenciales de <strong>{orgToDelete.ownerEmail}</strong>.</li>
                <li>No se podrá recuperar la información después de confirmar.</li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="text-xs h-9"
                  onClick={() => setOrgToDelete(null)}
                  disabled={actionLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="text-xs h-9 font-medium"
                  onClick={() => void handleDelete(orgToDelete)}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Eliminando…" : "Eliminar Permanentemente"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Creación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-lg shadow-xl animate-in fade-in-50 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Crear Cuenta para Cliente</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                  ✕
                </Button>
              </div>
              <CardDescription>
                Habilita al cliente al instante con su rubro y módulos a medida.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="clientName">Nombre del Responsable / Contacto</Label>
                  <Input
                    id="clientName"
                    required
                    placeholder="Ej: Dra. Valeria Gómez"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="businessName">Nombre del Negocio / Empresa</Label>
                  <Input
                    id="businessName"
                    required
                    placeholder="Ej: Clínica Dental Sonrisas"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rubro">Rubro / Módulos de Trabajo</Label>
                  <select
                    id="rubro"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                    value={selectedRubro}
                    onChange={(e) => setSelectedRubro(e.target.value as RubroId)}
                  >
                    <option value="servicios">Citas / Salud / Dental / Consultorio (Calendario con IA)</option>
                    <option value="escuela">Escuela Deportiva / Talleres (Malla de Cupos por categorías)</option>
                    <option value="comercio">Comercio / Ventas Generales (Sin citas ni cupos)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedRubro === "servicios"
                      ? "Activa Citas, horarios semanales y agendamiento automático por IA."
                      : selectedRubro === "escuela"
                      ? "Activa la malla de Cupos por categorías para academias deportivas."
                      : "Deja la interfaz limpia: Bandeja, Embudo, Contactos y Campañas masivas."}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Correo del Cliente (Usuario de acceso)</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="contacto@clinicasonrisas.pe"
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

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Creando cuenta…" : "Dar de Alta Cliente"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de clientes registrados */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes Registrados ({orgs.length})</CardTitle>
          <CardDescription>
            Administra los planes de tus clientes, añade +30 días, suspende su servicio temporalmente o elimina cuentas inactivas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 px-4 text-left">Negocio</th>
                  <th className="py-3 px-4 text-left">Dueño / Correo</th>
                  <th className="py-3 px-4 text-left">Rubro / Módulo</th>
                  <th className="py-3 px-4 text-left">Plan Actual</th>
                  <th className="py-3 px-4 text-left">Vigencia / Estado</th>
                  <th className="py-3 px-4 text-left">Creado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      Cargando clientes…
                    </td>
                  </tr>
                ) : orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay negocios registrados aún.
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => {
                    const active = isOrgActive(org);
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
                          <div className="flex items-center gap-2">
                            <span>{org.name}</span>
                            {org.isCurrentOrg && (
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                                Tu cuenta actual
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="font-medium text-foreground">{org.ownerName}</p>
                          <p className="text-muted-foreground">{org.ownerEmail}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className="text-xs rounded border bg-background px-2 py-1 font-medium"
                            value={org.rubro || "servicios"}
                            onChange={(e) => void handleRubroChange(org.id, e.target.value)}
                          >
                            <option value="servicios">Citas / Dental</option>
                            <option value="escuela">Escuela (Cupos)</option>
                            <option value="comercio">Comercio</option>
                          </select>
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {active ? (
                              isTrial ? (
                                <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-500/10 border-amber-500/30">
                                  Trial Activo
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">
                                  Pagado
                                </Badge>
                              )
                            ) : (
                              <Badge variant="destructive" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">
                                Suspendido / Vencido
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{fechaExp}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(org.createdAt).toLocaleDateString("es-PE")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {active ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 px-2.5 hover:bg-muted font-medium"
                                  onClick={() => void handleExtend(org.id)}
                                  title="Añadir +30 días de vigencia"
                                  disabled={actionLoading}
                                >
                                  +30 días
                                </Button>
                                {!org.isCurrentOrg && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-500/30 font-medium"
                                    onClick={() => setOrgToSuspend(org)}
                                    title="Pausar o suspender acceso"
                                    disabled={actionLoading}
                                  >
                                    Suspender
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                onClick={() => void handleReactivate(org.id)}
                                title="Reactivar servicio con +30 días"
                                disabled={actionLoading}
                              >
                                Reactivar (+30d)
                              </Button>
                            )}

                            {!org.isCurrentOrg && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-border"
                                onClick={() => setOrgToDelete(org)}
                                title="Eliminar cliente permanentemente"
                                disabled={actionLoading}
                              >
                                Eliminar
                              </Button>
                            )}
                          </div>
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
