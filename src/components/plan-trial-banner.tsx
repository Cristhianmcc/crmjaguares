"use client";

import Link from "next/link";

interface Props {
  diasRestantes: number | null;
  plan: string;
}

export function PlanTrialBanner({ diasRestantes, plan }: Props) {
  if (plan !== "trial" || diasRestantes === null || diasRestantes > 7)
    return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs sm:text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>
          {diasRestantes === 0
            ? "⚠️ Tu período de prueba de 14 días ha terminado."
            : `⚡ Te quedan ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} de prueba gratuita.`}
        </span>
      </div>
      <Link
        href="/settings/billing"
        className="font-bold underline hover:no-underline text-primary text-xs sm:text-sm ml-2 flex items-center gap-1"
      >
        <span>Activar plan con Yape o Plin</span>
        <span>→</span>
      </Link>
    </div>
  );
}
