import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { resolvePlanFeatures } from "@/lib/plan";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/** Phase 3.5: 실시간 요약 — 최근 10초 클릭, 60초 새 방문, TOP 클릭 요소, 평균 체류 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  const now = new Date();
  const tenSecAgo = new Date(now.getTime() - 10 * 1000);
  const sixtySecAgo = new Date(now.getTime() - 60 * 1000);

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });

  if (!page || page.is_deleted) {
    return apiErrorJson("not_found", 404);
  }

  const anonUserId = await resolveAnonUserId(req);
  const isOwner = anonUserId && page.owner.anon_id === anonUserId;

  if (!isOwner) {
    if (page.is_hidden) return apiErrorJson("not_found", 404);
    if (page.status !== "live") return apiErrorJson("not_found", 404);
    if (page.live_expires_at && page.live_expires_at <= now) {
      return apiErrorJson("not_found", 404);
    }
  }

  const [clicks10s, visits60s, topClicks] = await Promise.all([
    prisma.event.count({
      where: {
        page_id: pageId,
        type: "click",
        ts: { gte: tenSecAgo },
      },
    }),
    prisma.liveSession.count({
      where: {
        page_id: pageId,
        started_at: { gte: sixtySecAgo },
      },
    }),
    prisma.event.groupBy({
      by: ["element_id"],
      where: {
        page_id: pageId,
        type: "click",
        element_id: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  const top_element_id = topClicks[0]?.element_id ?? null;
  const top_elements = topClicks.map((t) => ({ element_id: t.element_id, count: t._count.id }));

  let replayEnabled = false;
  if (anonUserId) {
    const user = await ensureAnonUser(anonUserId);
    if (user?.plan) {
      const features = resolvePlanFeatures(user.plan);
      replayEnabled = features.replayEnabled === true;
    }
  }

  return NextResponse.json({
    clicks_10s: clicks10s,
    visits_60s: visits60s,
    top_element_id,
    top_elements,
    avg_dwell_s: Math.round((page.avg_duration_ms || 0) / 1000),
    replay_enabled: replayEnabled,
  });
}
