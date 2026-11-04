import Link from "next/link";
import { PLANES } from "@/lib/planes";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURED_PLANS = [PLANES.trial, PLANES.basico, PLANES.pro] as const;

export default function PreciosPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          ✨ Precios en Soles (PEN) · Sin contratos forzosos
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Planes simples y transparentes
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Comienza hoy mismo con 14 días gratis sin tarjeta. Elige el plan que mejor se adapte al volumen de tu negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURED_PLANS.map((plan) => {
          const isPro = plan.id === "pro";
          const isTrial = plan.id === "trial";
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col relative transition-all duration-200 hover:shadow-md",
                isPro && "border-primary shadow-lg ring-2 ring-primary"
              )}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    Recomendado · Más popular
                  </span>
                </div>
              )}
              {isTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                    Prueba sin costo
                  </span>
                </div>
              )}
              <CardHeader className="pb-2 pt-6">
                <CardTitle className="text-xl">{plan.nombre}</CardTitle>
                <CardDescription className="min-h-[40px] text-xs">
                  {plan.descripcion}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  {plan.precio === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-foreground">S/ 0</span>
                      <span className="text-muted-foreground text-sm font-medium">/ 14 días</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-foreground">S/ {plan.precio}</span>
                      <span className="text-muted-foreground text-sm font-medium">/ mes</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.precio === 0 ? "Sin tarjeta de crédito requerida" : "Facturación mensual en soles"}
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>
                      Hasta {plan.maxUsuarios} usuario{plan.maxUsuarios > 1 ? "s" : ""}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>
                      {plan.maxContactos === -1
                        ? "Contactos ilimitados"
                        : `Hasta ${plan.maxContactos.toLocaleString("es-PE")} contactos`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>Bandeja WhatsApp + Respuestas Rápidas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>Agente de Inteligencia Artificial</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.campanasMasivas ? (
                      <span className="text-emerald-500 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground/60 font-medium">✕</span>
                    )}
                    <span className={plan.campanasMasivas ? "" : "text-muted-foreground"}>
                      Campañas masivas programadas
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.whiteLabel ? (
                      <span className="text-emerald-500 font-bold">✓</span>
                    ) : (
                      <span className="text-muted-foreground/60 font-medium">✕</span>
                    )}
                    <span className={plan.whiteLabel ? "" : "text-muted-foreground"}>
                      Personalización de marca propia
                    </span>
                  </li>
                </ul>
              </CardContent>
              <div className="p-5 pt-0">
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({
                      variant: isPro ? "default" : isTrial ? "secondary" : "outline",
                    }),
                    "w-full font-medium"
                  )}
                >
                  {isTrial ? "Iniciar prueba gratis" : "Elegir este plan"}
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-14 max-w-2xl mx-auto rounded-xl border bg-muted/40 p-6 text-center">
        <h3 className="font-semibold text-base mb-1">¿Tienes dudas o necesitas una instalación personalizada?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ofrecemos servicio de puesta en marcha para configurar tus respuestas y entrenar a tu equipo desde el primer día.
        </p>
        <Link
          href="/register"
          className="text-primary font-medium hover:underline text-sm"
        >
          Crear cuenta gratuita por 14 días →
        </Link>
      </div>
    </div>
  );
}
