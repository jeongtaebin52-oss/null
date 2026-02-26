import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.5 기간 비교(A/B Diff): 현재 기간 vs 이전 동일 기간.
 * GET ?period=7d|30d → current, previous summary.
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
  const days = period === "7d" ? 7 : 30;
  const currentFrom = new Date(now);
  currentFrom.setDate(currentFrom.getDate() - days + 1);
  currentFrom.setHours(0, 0, 0, 0);
  const previousTo = new Date(currentFrom);
  previousTo.setMilliseconds(-1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - days + 1);
  previousFrom.setHours(0, 0, 0, 0);

  const [curSessions, curClicks, curDurations, prevSessions, prevClicks, prevDurations] = await Promise.all([
    prisma.liveSession.count({
      where: { page_id: pageId, started_at: { gte: currentFrom } },
    }),
    prisma.event.count({
      where: { page_id: pageId, type: "click", ts: { gte: currentFrom } },
    }),
    prisma.liveSession.findMany({
      where: { page_id: pageId, started_at: { gte: currentFrom }, ended_at: { not: null } },
      select: { duration_ms: true },
    }),
    prisma.liveSession.count({
      where: { page_id: pageId, started_at: { gte: previousFrom, lte: previousTo } },
    }),
    prisma.event.count({
      where: { page_id: pageId, type: "click", ts: { gte: previousFrom, lte: previousTo } },
    }),
    prisma.liveSession.findMany({
      where: {
        page_id: pageId,
        started_at: { gte: previousFrom, lte: previousTo },
        ended_at: { not: null },
      },
      select: { duration_ms: true },
    }),
  ]);

  const avg = (arr: { duration_ms: number | null }[]) => {
    const total = arr.reduce((s, x) => s + (x.duration_ms ?? 0), 0);
    return arr.length ? total / arr.length : 0;
  };
  const bounce = (arr: { duration_ms: number | null }[]) =>
    arr.length ? arr.filter((x) => (x.duration_ms ?? 0) < 5000).length / arr.length : 0;

  const current = {
    visits: curSessions,
    clicks: curClicks,
    avg_duration_ms: Math.round(avg(curDurations)),
    bounce_rate: Math.round(bounce(curDurations) * 100) / 100,
  };
  const previous = {
    visits: prevSessions,
    clicks: prevClicks,
    avg_duration_ms: Math.round(avg(prevDurations)),
    bounce_rate: Math.round(bounce(prevDurations) * 100) / 100,
  };

  const diff = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 100));
  return NextResponse.json({
    period,
    current: { ...current, from: currentFrom.toISOString(), to: now.toISOString() },
    previous: {
      ...previous,
      from: previousFrom.toISOString(),
      to: previousTo.toISOString(),
    },
    diff: {
      visits_pct: diff(current.visits, previous.visits),
      clicks_pct: diff(current.clicks, previous.clicks),
      avg_duration_pct: diff(current.avg_duration_ms, previous.avg_duration_ms),
      bounce_rate_pct: diff(current.bounce_rate * 100, previous.bounce_rate * 100),
    },
  });
}
