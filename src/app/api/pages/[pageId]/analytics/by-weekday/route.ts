import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * §31.6 요일별 집계.
 * GET ?period=7d|30d → { by_weekday: { dow: 0-6, day_name, visits }[] }
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";
  if (!["7d", "30d"].includes(period)) return apiErrorJson("invalid_period", 400);

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (period === "7d" ? 6 : 29));
  from.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ dow: number; c: bigint }[]>`
    SELECT EXTRACT(DOW FROM "started_at")::int AS dow, count(*)::bigint AS c
    FROM "LiveSession"
    WHERE "page_id" = ${pageId} AND "started_at" >= ${from}
    GROUP BY EXTRACT(DOW FROM "started_at")
    ORDER BY dow
  `;

  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    dow,
    day_name: DAY_NAMES[dow],
    visits: Number(rows.find((r) => r.dow === dow)?.c ?? 0),
  }));

  return NextResponse.json({ period, by_weekday: byWeekday });
}
