import { buildIcsFeed, verifyCalendarFeedToken } from "@/server/agenda/feed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("org") || url.searchParams.get("orgId");
  const token = url.searchParams.get("token");

  if (!orgId || !token) {
    return new Response("Parámetros 'org' y 'token' requeridos.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const valid = verifyCalendarFeedToken(orgId, token);
  if (!valid) {
    return new Response("Token de suscripción inválido o revocado.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const icsContent = await buildIcsFeed(orgId);
    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="citas.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error generating ICS feed:", error);
    return new Response("Error al generar el calendario.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

