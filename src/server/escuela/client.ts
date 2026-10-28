import { z } from "zod";
import {
  agruparClases,
  catalogoParaPrompt,
  type ClaseEscuela,
  type HorarioEscuela,
} from "@/lib/escuela";

/**
 * Puente de LECTURA con el sistema de la escuela (Express + MySQL).
 *
 * El CRM no escribe ahí: inscribir, cobrar y marcar asistencia sigue siendo
 * trabajo del sistema de la escuela. Aquí solo se consultan horarios y cupos
 * para que el equipo no tenga dos pestañas abiertas y para que el agente
 * pueda decir la verdad sobre una clase.
 *
 * Regla de oro: si la escuela no responde, el CRM sigue funcionando. Esta
 * función devuelve un fallo tipado, nunca lanza.
 */

const FILA = z.object({
  horario_id: z.coerce.number(),
  deporte: z.string(),
  dia: z.string(),
  hora_inicio: z.string(),
  hora_fin: z.string(),
  cupo_maximo: z.coerce.number(),
  cupos_ocupados: z.coerce.number(),
  categoria: z.string(),
  nivel: z.string().nullish(),
  genero: z.string().nullish(),
  precio: z.coerce.number().nullish(),
  plan: z.string().nullish(),
  ano_min: z.coerce.number().nullish(),
  ano_max: z.coerce.number().nullish(),
});

const RESPUESTA = z.object({
  success: z.literal(true),
  horarios: z.array(FILA),
});

export type CuposResult =
  | {
      ok: true;
      clases: ClaseEscuela[];
      actualizadoEn: string;
      /** "mysql" o lo que diga el backend; se muestra tal cual. */
      fuente: string | null;
    }
  | { ok: false; motivo: "sin_configurar" | "no_responde" | "respuesta_invalida" };

function aHorario(fila: z.infer<typeof FILA>): HorarioEscuela {
  return {
    id: fila.horario_id,
    deporte: fila.deporte,
    dia: fila.dia,
    horaInicio: fila.hora_inicio,
    horaFin: fila.hora_fin,
    cupoMaximo: fila.cupo_maximo,
    cuposOcupados: fila.cupos_ocupados,
    categoria: fila.categoria,
    nivel: fila.nivel ?? null,
    genero: fila.genero ?? null,
    precio: fila.precio ?? null,
    plan: fila.plan ?? null,
    desdeAnio: fila.ano_min ?? null,
    hastaAnio: fila.ano_max ?? null,
  };
}

/** URL base del sistema de la escuela, sin barra final. */
export function escuelaApiUrl(): string | null {
  const v = process.env.ESCUELA_API_URL;
  const limpio = typeof v === "string" ? v.trim().replace(/\/+$/, "") : "";
  return limpio.length > 0 ? limpio : null;
}

/**
 * Trae los horarios activos y los agrupa por clase.
 *
 * `refresh=true` pide al backend que salte su caché de 300 s: se usa cuando
 * alguien acaba de inscribir a un alumno y el cupo que ve importa.
 */
export async function cargarCupos(
  opts: { refresh?: boolean } = {}
): Promise<CuposResult> {
  const base = escuelaApiUrl();
  if (!base) return { ok: false, motivo: "sin_configurar" };

  let res: Response;
  try {
    res = await fetch(
      `${base}/api/horarios${opts.refresh ? "?refresh=true" : ""}`,
      // El backend de la escuela es local o de la red interna: sin caché de
      // Next, que aquí solo serviría para enseñar cupos viejos.
      { cache: "no-store", signal: AbortSignal.timeout(8_000) }
    );
  } catch {
    return { ok: false, motivo: "no_responde" };
  }

  if (!res.ok) return { ok: false, motivo: "no_responde" };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, motivo: "respuesta_invalida" };
  }

  const parsed = RESPUESTA.safeParse(json);
  if (!parsed.success) return { ok: false, motivo: "respuesta_invalida" };

  const clases = agruparClases(parsed.data.horarios.map(aHorario));
  return {
    ok: true,
    clases,
    actualizadoEn: new Date().toISOString(),
    fuente:
      typeof (json as { source?: unknown }).source === "string"
        ? String((json as { source?: unknown }).source)
        : null,
  };
}

/**
 * Catálogo en vivo para el prompt del agente, cacheado.
 *
 * Sin caché, cada turno del agente golpearía el backend de la escuela: una
 * conversación de cinco mensajes son cinco consultas a MySQL para responder
 * lo mismo. Cinco minutos es el equilibrio entre «dato fresco» y no molestar
 * al sistema que atiende inscripciones.
 *
 * Si el backend no responde, se devuelve null y el prompt sale como siempre
 * (el conocimiento base sigue contestando): una escuela con el servidor caído
 * no debe dejar al agente mudo.
 */
let cacheCatalogo: { texto: string | null; hasta: number } | null = null;

const CATALOGO_TTL_MS = 5 * 60 * 1000;
/** Un fallo se recuerda menos: si vuelve, se reintenta pronto. */
const CATALOGO_FALLO_MS = 60 * 1000;

export async function catalogoEnVivo(): Promise<string | null> {
  const ahora = Date.now();
  if (cacheCatalogo && cacheCatalogo.hasta > ahora) return cacheCatalogo.texto;

  const res = await cargarCupos();
  if (!res.ok) {
    cacheCatalogo = { texto: null, hasta: ahora + CATALOGO_FALLO_MS };
    return null;
  }
  const texto = catalogoParaPrompt(res.clases);
  const valor = texto.length > 0 ? texto : null;
  cacheCatalogo = { texto: valor, hasta: ahora + CATALOGO_TTL_MS };
  return valor;
}

/** Vacía la caché del catálogo (pruebas o tras cambiar de escuela). */
export function olvidarCatalogo(): void {
  cacheCatalogo = null;
}
