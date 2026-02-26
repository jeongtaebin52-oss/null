import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.10 데이터 품질: 기간 내 수집 상태·급감 탐지.
 * GET ?period=7d|30d → last_event_at, visits_today, visits_yesterday, drop_warning
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";
  if (!["7d", "30d"].includes(period)) {
    return apiErrorJson("invalid_period", 400);
  }

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const days = period === "7d" ? 7 : 30;
  const rangeStart = new Date(todayStart);
  rangeStart.setDate(rangeStart.getDate() - days + 1);

  const [lastEvent, visitsToday, visitsYesterday, dailyCounts] = await Promise.all([
    prisma.event.findFirst({
      where: { page_id: pageId },
      orderBy: { ts: "desc" },
      select: { ts: true },
    }),
    prisma.liveSession.count({
      where: { page_id: pageId, started_at: { gte: todayStart } },
    }),
    prisma.liveSession.count({
      where: {
        page_id: pageId,
        started_at: { gte: yesterdayStart, lt: todayStart },
      },
    }),
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "started_at")::date AS d, count(*)::bigint AS c
      FROM "LiveSession"
      WHERE "page_id" = ${pageId} AND "started_at" >= ${rangeStart}
      GROUP BY date_trunc('day', "started_at")
    `,
  ]);

  const dropThreshold = 0.5;
  const dropWarning =
    visitsYesterday > 2 && visitsToday < visitsYesterday * dropThreshold;

  const dateToKey = (d: Date) => (d instanceof Date ? d : new Date(d as unknown as string)).toISOString().slice(0, 10);
  const hasVisits = new Set(dailyCounts.map((r) => dateToKey(r.d)).map((k) => k));
  const gaps: string[] = [];
  const walk = new Date(rangeStart);
  while (walk < todayStart) {
    const key = walk.toISOString().slice(0, 10);
    if (!hasVisits.has(key)) gaps.push(key);
    walk.setDate(walk.getDate() + 1);
  }

  return NextResponse.json({
    last_event_at: lastEvent?.ts ?? null,
    visits_today: visitsToday,
    visits_yesterday: visitsYesterday,
    drop_warning: dropWarning,
    gaps,
  });
}
