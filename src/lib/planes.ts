export type PlanId = "trial" | "basico" | "pro" | "agencia";

export interface Plan {
  id: PlanId;
  nombre: string;
  precio: number; // USD/mes
  maxUsuarios: number;
  maxContactos: number; // -1 = ilimitado
  campanasMasivas: boolean;
  whiteLabel: boolean;
  descripcion: string;
}

export const PLANES: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    nombre: "Prueba gratuita",
    precio: 0,
    maxUsuarios: 2,
    maxContactos: 100,
    campanasMasivas: false,
    whiteLabel: false,
    descripcion: "14 días gratis, sin tarjeta",
  },
  basico: {
    id: "basico",
    nombre: "Básico",
    precio: 49,
    maxUsuarios: 2,
    maxContactos: 500,
    campanasMasivas: false,
    whiteLabel: false,
    descripcion: "Para negocios que empiezan",
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    precio: 99,
    maxUsuarios: 5,
    maxContactos: -1,
    campanasMasivas: true,
    whiteLabel: false,
    descripcion: "Para equipos en crecimiento",
  },
  agencia: {
    id: "agencia",
    nombre: "Agencia",
    precio: 199,
    maxUsuarios: 10,
    maxContactos: -1,
    campanasMasivas: true,
    whiteLabel: true,
    descripcion: "Para agencias y revendedores",
  },
};

export function getPlan(planId: string | null | undefined): Plan {
  return PLANES[(planId as PlanId) ?? "trial"] ?? PLANES.trial;
}

