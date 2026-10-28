import { withAuth } from "@/lib/api";
import { cargarCupos } from "@/server/escuela/client";

export const dynamic = "force-dynamic";

/**
 * Cupos para el botón «Actualizar» de la pantalla. Es una lectura del sistema
 * de la escuela: si ese backend está apagado, responde 200 con `ok: false` y
 * la pantalla lo explica. Un 500 aquí solo haría ruido en los logs.
 */
export const GET = withAuth(async (_session, req: Request) => {
  const refresh = new URL(req.url).searchParams.get("refresh") === "true";
  return Response.json(await cargarCupos({ refresh }));
});
