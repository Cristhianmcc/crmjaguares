"use client";

interface Props {
  diasRestantes: number | null;
  plan: string;
}

export function PlanTrialBanner({ diasRestantes, plan }: Props) {
  if (plan !== "trial" || diasRestantes === null || diasRestantes > 7)
    return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 flex items-center justify-between">
      <span>
        {diasRestantes === 0
          ? "⚠️ Tu período de prueba ha terminado"
          : `⚡ Te quedan ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} de prueba gratuita`}
      </span>
      <a href="/precios" className="font-medium underline hover:no-underline">
        Ver planes →
      </a>
    </div>
  );
}

