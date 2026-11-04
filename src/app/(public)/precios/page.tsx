import Link from "next/link";
import { PLANES } from "@/lib/planes";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURED_PLANS = [PLANES.basico, PLANES.pro, PLANES.agencia] as const;

export default function PreciosPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Planes para cada negocio
        </h1>
        <p className="text-muted-foreground text-lg">
          Comienza con 14 días gratis, sin tarjeta de crédito.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURED_PLANS.map((plan) => {
          const isPro = plan.id === "pro";
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col relative",
                isPro && "border-primary shadow-lg ring-2 ring-primary"
              )}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Más popular
                  </span>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{plan.nombre}</CardTitle>
                <CardDescription>{plan.descripcion}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.precio}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>
                      Hasta {plan.maxUsuarios} usuario
                      {plan.maxUsuarios > 1 ? "s" : ""}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>
                      {plan.maxContactos === -1
                        ? "Contactos ilimitados"
                        : `Hasta ${plan.maxContactos} contactos`}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.campanasMasivas ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-muted-foreground">✗</span>
                    )}
                    <span
                      className={
                        plan.campanasMasivas ? "" : "text-muted-foreground"
                      }
                    >
                      Campañas masivas
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {plan.whiteLabel ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-muted-foreground">✗</span>
                    )}
                    <span
                      className={plan.whiteLabel ? "" : "text-muted-foreground"}
                    >
                      White label
                    </span>
                  </li>
                </ul>
              </CardContent>
              <div className="p-5 pt-0">
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({
                      variant: isPro ? "default" : "outline",
                    }),
                    "w-full"
                  )}
                >
                  Empezar gratis
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-10">
        Todos los planes incluyen 14 días de prueba gratuita.{" "}
        <Link href="/register" className="text-primary hover:underline">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
