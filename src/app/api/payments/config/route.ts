import { NextResponse } from "next/server";
import { getTaypiConfig } from "@/server/taypi/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getTaypiConfig();
  return NextResponse.json({
    enabled: config.enabled,
    mode: config.mode,
    publicKey: config.publicKey,
  });
}

