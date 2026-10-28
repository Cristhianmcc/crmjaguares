"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Server } from "lucide-react";
import { ZernioWhatsappCard } from "@/components/settings/whatsapp-zernio-card";
import { WhatsappWizard } from "@/components/settings/whatsapp-wizard";

export default function WhatsappSettingsPage() {
  const [activeTab, setActiveTab] = useState<"zernio" | "meta">("zernio");
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/whatsapp")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.connection?.source === "meta") {
          setActiveTab("meta");
        } else {
          setActiveTab("zernio");
        }
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  if (initialLoading) {
    return <p className="text-sm text-muted-foreground">Cargando conexión de WhatsApp...</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Selector de tipo de conexión */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("zernio")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "zernio"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Server className="h-4 w-4 text-primary" />
          Zernio (Recomendado)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("meta")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === "meta"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Meta Cloud API
        </button>
      </div>

      {activeTab === "zernio" ? (
        <ZernioWhatsappCard onSaved={() => window.location.reload()} />
      ) : (
        <WhatsappWizard />
      )}
    </div>
  );
}
