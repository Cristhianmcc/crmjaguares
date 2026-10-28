/**
 * La escuela, en datos que el CRM entiende.
 *
 * El backend de la escuela (Express + MySQL) devuelve un horario por renglón:
 * un deporte, una categoría, un día y una hora. El CRM no guarda nada de eso
 * —es dueño de sus alumnos, no de la malla de horarios— así que esta capa
 * traduce y agrupa para poder mirarlo sin leer cien filas.
 *
 * Funciones puras a propósito: la pantalla de Cupos y sus pruebas no necesitan
 * el backend levantado.
 */

export type HorarioEscuela = {
  id: number;
  deporte: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  cupoMaximo: number;
  cuposOcupados: number;
  categoria: string;
  nivel: string | null;
  genero: string | null;
  precio: number | null;
  plan: string | null;
  desdeAnio: number | null;
  hastaAnio: number | null;
};

export type DiaCupo = {
  dia: string;
  cupoMaximo: number;
  cuposOcupados: number;
  libres: number;
};

export type ClaseEscuela = {
  /** deporte + categoría + hora: estable entre recargas, sirve de key. */
  id: string;
  deporte: string;
  categoria: string;
  nivel: string | null;
  genero: string | null;
  horaInicio: string;
  horaFin: string;
  precio: number | null;
  plan: string | null;
  desdeAnio: number | null;
  hastaAnio: number | null;
  dias: DiaCupo[];
  /** Vacantes sumando todos los días de la clase. */
  libres: number;
  cupoMaximo: number;
  cuposOcupados: number;
};

const ORDEN_DIAS = [
  "lunes",
  "martes",
  "miércoles",
  "miercoles",
  "jueves",
  "viernes",
  "sábado",
  "sabado",
  "domingo",
];

function posicionDia(dia: string): number {
  const i = ORDEN_DIAS.indexOf(dia.trim().toLowerCase());
  return i === -1 ? 99 : i;
}

/** "Lunes" → "Lun". Para chips y resúmenes cortos. */
export function diaCorto(dia: string): string {
  const limpio = dia.trim();
  return limpio.length <= 3 ? limpio : limpio.slice(0, 3);
}

/** "Fútbol · Mini · Lun, mié y vie · 16:00-17:30 · 3 cupos" */
export function resumenClase(clase: ClaseEscuela): string {
  const dias = clase.dias.map((d) => diaCorto(d.dia)).join(", ");
  const cupos =
    clase.libres > 0
      ? `${clase.libres} ${clase.libres === 1 ? "cupo" : "cupos"}`
      : "sin cupos";
  return [
    clase.deporte,
    clase.categoria,
    dias,
    `${clase.horaInicio}-${clase.horaFin}`,
    cupos,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Agrupa los renglones por clase (deporte + categoría + hora) y deja un cupo
 * por día dentro de cada una. Un mismo horario de martes y jueves son dos
 * renglones en la base y una sola clase en la cabeza de quien inscribe.
 */
export function agruparClases(horarios: HorarioEscuela[]): ClaseEscuela[] {
  const mapa = new Map<string, ClaseEscuela>();

  for (const h of horarios) {
    const id = [h.deporte, h.categoria, h.horaInicio, h.horaFin].join("|");
    const libres = Math.max(0, h.cupoMaximo - h.cuposOcupados);
    const dia: DiaCupo = {
      dia: h.dia,
      cupoMaximo: h.cupoMaximo,
      cuposOcupados: h.cuposOcupados,
      libres,
    };
    const existente = mapa.get(id);
    if (!existente) {
      mapa.set(id, {
        id,
        deporte: h.deporte,
        categoria: h.categoria,
        nivel: h.nivel,
        genero: h.genero,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
        precio: h.precio,
        plan: h.plan,
        desdeAnio: h.desdeAnio,
        hastaAnio: h.hastaAnio,
        dias: [dia],
        libres,
        cupoMaximo: h.cupoMaximo,
        cuposOcupados: h.cuposOcupados,
      });
      continue;
    }
    existente.dias.push(dia);
    existente.libres += libres;
    existente.cupoMaximo += h.cupoMaximo;
    existente.cuposOcupados += h.cuposOcupados;
  }

  return [...mapa.values()]
    .map((c) => ({
      ...c,
      dias: [...c.dias].sort((a, b) => posicionDia(a.dia) - posicionDia(b.dia)),
    }))
    .sort(
      (a, b) =>
        a.deporte.localeCompare(b.deporte, "es") ||
        (a.desdeAnio ?? 99) - (b.desdeAnio ?? 99) ||
        a.categoria.localeCompare(b.categoria, "es") ||
        a.horaInicio.localeCompare(b.horaInicio)
    );
}

/** Los deportes presentes, para los filtros de la pantalla. */
export function deportesDe(clases: ClaseEscuela[]): string[] {
  return [...new Set(clases.map((c) => c.deporte))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

/** Totales para el encabezado: clases, vacantes y clases sin lugar. */
export function resumenDe(clases: ClaseEscuela[]): {
  clases: number;
  vacantes: number;
  llenas: number;
} {
  return {
    clases: clases.length,
    vacantes: clases.reduce((suma, c) => suma + c.libres, 0),
    llenas: clases.filter((c) => c.libres === 0).length,
  };
}

/**
 * ¿El número es un año de nacimiento o una edad?
 *
 * La tabla `horarios` de la escuela guarda el rango como AÑOS DE NACIMIENTO
 * (`ano_min = 2018`, `ano_max = 2021`), no como edades. Mostrarlos como
 * «2018 a 2021 años» era una frase sin sentido; y calcular la edad a mano
 * cambia cada 1 de enero, así que se declara el año y se aproxima la edad.
 */
function esAnioNacimiento(valor: number): boolean {
  return valor >= 1900;
}

/** Rango de edad legible, venga como edad o como año de nacimiento. */
export function edadDe(clase: ClaseEscuela): string {
  const { desdeAnio, hastaAnio } = clase;
  if (desdeAnio && hastaAnio) {
    if (esAnioNacimiento(desdeAnio) || esAnioNacimiento(hastaAnio)) {
      const anioActual = new Date().getFullYear();
      // El mayor nació en el año más antiguo.
      const mayor = Math.max(0, anioActual - Math.min(desdeAnio, hastaAnio));
      const menor = Math.max(0, anioActual - Math.max(desdeAnio, hastaAnio));
      return `nacidos ${Math.min(desdeAnio, hastaAnio)}-${Math.max(desdeAnio, hastaAnio)} (≈${menor} a ${mayor} años)`;
    }
    return `${desdeAnio} a ${hastaAnio} años`;
  }
  if (desdeAnio) {
    return esAnioNacimiento(desdeAnio)
      ? `nacidos desde ${desdeAnio}`
      : `Desde ${desdeAnio} años`;
  }
  if (hastaAnio) {
    return esAnioNacimiento(hastaAnio)
      ? `nacidos hasta ${hastaAnio}`
      : `Hasta ${hastaAnio} años`;
  }
  return "Todas las edades";
}

/** Cómo se nombra cada día en el catálogo del agente. */
const DIA_LARGO: Record<string, string> = {
  lunes: "lun",
  martes: "mar",
  miércoles: "mié",
  miercoles: "mié",
  jueves: "jue",
  viernes: "vie",
  sábado: "sáb",
  sabado: "sáb",
  domingo: "dom",
};

function diasCortos(clase: ClaseEscuela): string {
  return clase.dias
    .map((d) => DIA_LARGO[d.dia.trim().toLowerCase()] ?? d.dia)
    .join(", ");
}

/**
 * El catálogo que ve el agente: planes, horarios y deportes, tal como están
 * en el sistema de la escuela AHORA.
 *
 * Es texto a propósito: entra en el prompt y el modelo lo lee como una lista.
 * No incluye alumnos, apoderados ni pagos porque la fuente (`/api/horarios`)
 * no los expone — esa es la garantía de privacidad, no un filtro posterior.
 *
 * `limite` acota los tokens: con seis disciplinas y sus categorías entran
 * todas; si mañana hay cincuenta, se recorta y el conocimiento base sigue
 * cubriendo lo que no quepa.
 */
export function catalogoParaPrompt(
  clases: ClaseEscuela[],
  limite = 40
): string {
  if (clases.length === 0) return "";
  return clases
    .slice(0, limite)
    .map((c) => {
      const cuposLabel =
        c.libres === 0
          ? "SIN CUPOS"
          : c.libres <= 3
            ? `⚠️ ÚLTIMOS ${c.libres} ${c.libres === 1 ? "CUPO" : "CUPOS"} — inscripción urgente`
            : `${c.libres} cupos`;
      const partes = [
        c.deporte,
        c.categoria,
        edadDe(c),
        diasCortos(c),
        `${c.horaInicio}-${c.horaFin}`,
        cuposLabel,
      ];
      if (c.plan) partes.push(c.plan);
      if (c.precio !== null) partes.push(`S/ ${c.precio.toFixed(2)}`);
      return `- ${partes.filter(Boolean).join(" · ")}`;
    })
    .join("\n");
}
