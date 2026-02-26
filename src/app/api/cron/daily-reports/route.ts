import { NextResponse } from "next/server";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { runDailyReports } from "@/lib/daily-reports";

/**
 * Cron: daily reports + drop alerts.
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return apiErrorJson("unauthorized", 401);
  }

  await expireStalePages();

  const result = await runDailyReports(new Date());
  return NextResponse.json({ ok: true, ...result });
}
