import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";
import { apiErrorJson } from "@/lib/api-error";

/** §29.10 모니터링·헬스체크 — GET /api/health */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("health check failed", { error: String(e) });
    return apiErrorJson("service_unavailable", 503);
  }
}
