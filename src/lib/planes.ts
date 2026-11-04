export type PlanId = "trial" | "basico" | "pro" | "agencia" | "test";

export interface Plan {
  id: PlanId;
  nombre: string;
  precio: number; // Soles (PEN) por mes
  moneda: string;
  simbolo: string;
  maxUsuarios: number;
  maxContactos: number; // -1 = ilimitado
  campanasMasivas: boolean;
  whiteLabel: boolean;
  descripcion: string;
}

export const PLANES: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    nombre: "Prueba Gratuita",
    precio: 0,
    moneda: "PEN",
    simbolo: "S/",
    maxUsuarios: 2,
    maxContactos: 200,
    campanasMasivas: false,
    whiteLabel: false,
    descripcion: "14 días de prueba con todas las funciones para probar",
  },
  test: {
    id: "test",
    nombre: "Prueba de Cobro",
    precio: 1, // S/ 1.00
    moneda: "PEN",
    simbolo: "S/",
    maxUsuarios: 10,
    maxContactos: -1,
    campanasMasivas: true,
    whiteLabel: true,
    descripcion: "Pago de prueba de S/ 1.00 para verificar que el dinero ingresa a Taypi",
  },
  basico: {
    id: "basico",
    nombre: "Plan Básico",
    precio: 79,
    moneda: "PEN",
    simbolo: "S/",
    maxUsuarios: 2,
    maxContactos: 1500,
    campanasMasivas: false,
    whiteLabel: false,
    descripcion: "Ideal para colegios, consultorios o negocios que empiezan",
  },
  pro: {
    id: "pro",
    nombre: "Plan Pro",
    precio: 109,
    moneda: "PEN",
    simbolo: "S/",
    maxUsuarios: 5,
    maxContactos: -1,
    campanasMasivas: true,
    whiteLabel: true,
    descripcion: "Para negocios con alta demanda, campañas masivas y más asesores",
  },
  agencia: {
    id: "agencia",
    nombre: "Plan Corporativo / Agencia",
    precio: 249,
    moneda: "PEN",
    simbolo: "S/",
    maxUsuarios: 15,
    maxContactos: -1,
    campanasMasivas: true,
    whiteLabel: true,
    descripcion: "Múltiples sucursales, sedes o revendedores",
  },
};

export function getPlan(planId: string | null | undefined): Plan {
  return PLANES[(planId as PlanId) ?? "trial"] ?? PLANES.trial;
}
