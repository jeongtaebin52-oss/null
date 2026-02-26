import { NextResponse } from "next/server";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { logApiError } from "@/lib/logger";

/**
 * Cron: 24h 만료 자동화.
 * Vercel Cron에서 주기 호출 시 CRON_SECRET으로 인증.
 * 로컬/다른 스케줄러에서도 Authorization: Bearer <CRON_SECRET> 으로 호출 가능.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return apiErrorJson("unauthorized", 401);
  }

  try {
    const count = await expireStalePages(new Date());
    return NextResponse.json({ ok: true, expired: count });
  } catch (e) {
    logApiError(req, "cron expire failed", e);
    return apiErrorJson("expire_failed", 500);
  }
}
