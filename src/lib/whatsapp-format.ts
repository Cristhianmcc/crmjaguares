/**
 * Cómo se ve una respuesta en WhatsApp.
 *
 * El modelo escribe para un chat, pero no siempre: aparece `**negrita**` (que
 * WhatsApp no interpreta), títulos, listas con guiones y párrafos de seis
 * líneas. Una empresa de call center no manda eso: manda dos o tres líneas,
 * tres opciones como máximo y una pregunta clara.
 *
 * Estas funciones son puras para poder probarlas sin red ni base de datos.
 */

/** Convierte el markdown que el modelo suele emitir al que WhatsApp entiende. */
export function formatearParaWhatsapp(texto: string): string {
  let t = texto.replace(/\r\n/g, "\n");

  // **negrita** / __negrita__ → *negrita* (única que WhatsApp renderiza).
  t = t.replace(/\*\*(.+?)\*\*/g, "*$1*");
  t = t.replace(/__(.+?)__/g, "*$1*");

  // Títulos markdown: "## Horarios" → "*Horarios*" en su propia línea.
  t = t.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Guiones y asteriscos de lista → viñeta.
  t = t.replace(/^\s*[-*]\s+/gm, "• ");

  // Espacios sobrantes al final de cada línea y líneas de solo espacios.
  t = t
    .split("\n")
    .map((linea) => linea.replace(/[ \t]+$/g, ""))
    .join("\n");

  // Tres o más saltos seguidos marean en un chat.
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

/**
 * Parte una respuesta larga en dos mensajes, por párrafo.
 *
 * Los call centers mandan primero el resumen y después el detalle; un solo
 * bloque de 900 caracteres se lee como un comunicado. Se parte SOLO en un
 * salto de párrafo y solo si ambos lados quedan con sentido: nunca a mitad de
 * una frase ni de una lista.
 */
export function partirMensaje(texto: string, maxChars = 600): string[] {
  const t = texto.trim();
  if (t.length <= maxChars) return [t];

  const parrafos = t.split(/\n{2,}/);
  if (parrafos.length < 2) return [t];

  // El corte va en el último párrafo que quepa; si el primero ya se pasa, no
  // se parte (mejor un mensaje largo que dos mitades rotas).
  let corte = -1;
  let acumulado = 0;
  for (let i = 0; i < parrafos.length; i++) {
    const siguiente = acumulado + (parrafos[i]?.length ?? 0) + 2;
    if (siguiente > maxChars) break;
    acumulado = siguiente;
    corte = i;
  }
  if (corte < 0 || corte >= parrafos.length - 1) return [t];

  const primero = parrafos.slice(0, corte + 1).join("\n\n").trim();
  const segundo = parrafos.slice(corte + 1).join("\n\n").trim();
  if (primero.length < 40 || segundo.length < 40) return [t];
  return [primero, segundo];
}
