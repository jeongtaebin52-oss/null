import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { pageId: string };

/**
 * §31.7 대시보드 데이터 내보내기.
 * GET ?period=today|7d|30d → CSV (날짜, 방문, 클릭).
 * §31.9 레이트 리밋: IP당 10회/분.
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const rl = await checkRateLimit(req, 10, 60_000);
  if (!rl.allowed) {
    return apiErrorJson("rate_limit", 429, {
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      headers: { "X-RateLimit-Remaining": "0", "Retry-After": "60" },
    });
  }

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";
  if (!["today", "7d", "30d"].includes(period)) {
    return apiErrorJson("invalid_period", 400);
  }

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) {
    return apiErrorJson("forbidden", 403);
  }

  const now = new Date();
  let from: Date;
  if (period === "today") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date(now);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }

  const [dailySessions, dailyClicks] = await Promise.all([
    period === "today"
      ? prisma.liveSession.count({ where: { page_id: pageId, started_at: { gte: from } } }).then((c) => [{ d: from, c: BigInt(c) }])
      : prisma.$queryRaw<{ d: Date; c: bigint }[]>`
          SELECT date_trunc('day', "started_at")::date AS d, count(*)::bigint AS c
          FROM "LiveSession"
          WHERE "page_id" = ${pageId} AND "started_at" >= ${from}
          GROUP BY date_trunc('day', "started_at")
          ORDER BY 1 ASC
        `,
    period === "today"
      ? prisma.event.count({ where: { page_id: pageId, type: "click", ts: { gte: from } } }).then((c) => [{ d: from, c: BigInt(c) }])
      : prisma.$queryRaw<{ d: Date; c: bigint }[]>`
          SELECT date_trunc('day', "ts")::date AS d, count(*)::bigint AS c
          FROM "Event"
          WHERE "page_id" = ${pageId} AND "type" = 'click' AND "ts" >= ${from}
          GROUP BY date_trunc('day', "ts")
          ORDER BY 1 ASC
        `,
  ]);

  const dayMap = new Map<string, { visits: number; clicks: number }>();
  for (const row of dailySessions) {
    const d = row.d instanceof Date ? row.d : new Date(row.d as unknown as string);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { visits: Number(row.c), clicks: dayMap.get(key)?.clicks ?? 0 });
  }
  for (const row of dailyClicks) {
    const d = row.d instanceof Date ? row.d : new Date(row.d as unknown as string);
    const key = d.toISOString().slice(0, 10);
    const cur = dayMap.get(key) ?? { visits: 0, clicks: 0 };
    cur.clicks = Number(row.c);
    dayMap.set(key, cur);
  }

  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const walk = new Date(from);
  const rows: { date: string; visits: number; clicks: number }[] = [];
  while (walk <= to) {
    const key = walk.toISOString().slice(0, 10);
    rows.push({
      date: key,
      visits: dayMap.get(key)?.visits ?? 0,
      clicks: dayMap.get(key)?.clicks ?? 0,
    });
    walk.setDate(walk.getDate() + 1);
  }

  const header = "날짜,방문,클릭\n";
  const body = rows.map((r) => `${r.date},${r.visits},${r.clicks}`).join("\n");
  const csv = "\uFEFF" + header + body;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${pageId.slice(0, 8)}-${period}.csv"`,
    },
  });
}

