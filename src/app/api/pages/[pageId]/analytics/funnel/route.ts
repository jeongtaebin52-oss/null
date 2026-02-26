import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.5 퍼널: 기간별 진입 → 스크롤 → 클릭 단계별 세션 수.
 * GET ?period=today|7d|30d → { steps: { name, count }[] }
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

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
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

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

  const [enterCount, scrollResult, clickResult] = await Promise.all([
    prisma.liveSession.count({ where: { page_id: pageId, started_at: { gte: from } } }),
    prisma.event.groupBy({
      by: ["live_session_id"],
      where: { page_id: pageId, type: "scroll", ts: { gte: from } },
      _count: { live_session_id: true },
    }),
    prisma.event.groupBy({
      by: ["live_session_id"],
      where: { page_id: pageId, type: "click", ts: { gte: from } },
      _count: { live_session_id: true },
    }),
  ]);

  const scrollCount = scrollResult.length;
  const clickCount = clickResult.length;

  return NextResponse.json({
    period,
    steps: [
      { name: "진입", count: enterCount },
      { name: "스크롤", count: scrollCount },
      { name: "클릭", count: clickCount },
    ],
  });
}
