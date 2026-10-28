import { CuposClient } from "@/components/escuela/cupos-client";
import { cargarCupos } from "@/server/escuela/client";

export const dynamic = "force-dynamic";

/**
 * Cupos de la escuela. La primera carga se hace en el servidor para que la
 * pantalla no parpadee; el botón «Actualizar» vuelve a preguntar por la API
 * con `refresh=true` (salta el caché de 300 s del backend de la escuela).
 */
export default async function CuposPage() {
  const data = await cargarCupos();
  return (
    <CuposClient
      inicial={data.ok ? data.clases : []}
      actualizadoEnInicial={data.ok ? data.actualizadoEn : null}
      fuenteInicial={data.ok ? data.fuente : null}
      motivoInicial={data.ok ? null : data.motivo}
    />
  );
}
