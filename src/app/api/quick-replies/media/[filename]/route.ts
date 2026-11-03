import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiError, withAuth } from "@/lib/api";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ filename: string }> };

export const GET = withAuth(async (session, _req: Request, ctx: Params) => {
  const { filename } = await ctx.params;
  if (!/^[\w.-]{1,100}$/.test(filename)) {
    return apiError(422, "invalid", "Nombre de archivo inválido");
  }

  const filepath = path.join(
    getEnv().MEDIA_DIR,
    "quick-replies",
    session.organizationId,
    filename
  );

  try {
    const data = await readFile(filepath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return apiError(404, "not_found", "Archivo no encontrado");
  }
});
