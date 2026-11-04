import { requireSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { name } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Nombre inválido" }, { status: 422 });
    }
    const db = getDb();
    await db
      .update(schema.organization)
      .set({ name: name.trim().slice(0, 80) })
      .where(eq(schema.organization.id, session.organizationId));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}

