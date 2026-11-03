import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { apiError, withAuth } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { newId } from "@/lib/db/ids";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

export const POST = withAuth(async (session, req: Request) => {
  if (session.role === "member") {
    return apiError(
      403,
      "forbidden",
      "Solo administradores pueden subir adjuntos para respuestas rápidas"
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return apiError(400, "invalid", "Se esperaba multipart/form-data");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return apiError(422, "invalid", "Falta el archivo (campo file)");
  }

  if (file.size > MAX_FILE_SIZE) {
    return apiError(413, "too_large", "El archivo no puede superar 16 MB");
  }

  const cleanName = file.name.replace(/[^\w.-]/g, "_");
  const ext = path.extname(cleanName) || "";
  const baseId = newId("mediaAsset");
  const filename = `${baseId}${ext}`;

  const dir = path.join(getEnv().MEDIA_DIR, "quick-replies", session.organizationId);
  await mkdir(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const url = `/api/quick-replies/media/${filename}`;

  return Response.json({
    url,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
});
