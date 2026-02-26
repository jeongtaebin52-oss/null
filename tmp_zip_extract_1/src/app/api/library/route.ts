import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { resolvePlanFeatures } from "@/lib/plan";

export async function GET(req: Request) {
  await expireStalePages();

  // 1. anon user resolve
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return NextResponse.json(
      { error: "anon_user_id_required" },
      { status: 401 }
    );
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return NextResponse.json(
      { error: "user_not_found" },
      { status: 404 }
    );
  }

  // 2. plan / feature resolve
  const plan = await prisma.plan.findUnique({
    where: { id: user.plan_id },
  });

  const features = resolvePlanFeatures(
    plan ??
      ({
        id: user.plan_id,
        name: "",
        price_cents: null,
        features: {},
      } as any)
  );

  const replayEnabled = features.replayEnabled === true;

  // 3. pages
  const pages = await prisma.page.findMany({
    where: {
      owner_id: user.id,
      is_deleted: false,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  const now = new Date();

  const live = pages.filter(
    (p) =>
      p.status === "live" &&
      p.live_expires_at !== null &&
      p.live_expires_at > now
  );

  const drafts = pages.filter((p) => p.status === "draft");
  const history = pages.filter((p) => p.status === "expired");

  // 4. today range
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const pageIds = pages.map((p) => p.id);

  // 5. visits today
  const visitsToday = pageIds.length
    ? await prisma.liveSession.count({
        where: {
          page_id: { in: pageIds },
          started_at: { gte: startOfToday },
        },
      })
    : 0;

  // 6. last seen
  const lastEnded = pageIds.length
    ? await prisma.liveSession.findFirst({
        where: {
          page_id: { in: pageIds },
          ended_at: { not: null },
        },
        orderBy: { ended_at: "desc" },
        select: { ended_at: true },
      })
    : null;

  const lastStarted =
    lastEnded?.ended_at ??
    (pageIds.length
      ? (
          await prisma.liveSession.findFirst({
            where: { page_id: { in: pageIds } },
            orderBy: { started_at: "desc" },
            select: { started_at: true },
          })
        )?.started_at
      : null) ??
    null;

  // 7. Pro features (events)
  let clicksToday: number | null = null;
  let topElementId: string | null = null;
  let topElements:
    | { element_id: string; count: number }[]
    | null = null;

  if (replayEnabled && pageIds.length) {
    // clicks today
    clicksToday = await prisma.event.count({
      where: {
        page_id: { in: pageIds },
        type: "click",
        ts: { gte: startOfToday },
      },
    });

    // top 3 clicked elements today
    const grouped = await prisma.event.groupBy({
      by: ["element_id"],
      where: {
        page_id: { in: pageIds },
        type: "click",
        ts: { gte: startOfToday },
        element_id: { not: null },
      },
      _count: {
        element_id: true,
      },
      orderBy: {
        _count: {
          element_id: "desc",
        },
      },
      take: 3,
    });

    topElements = grouped
      .filter((r) => typeof r.element_id === "string")
      .map((r) => ({
        element_id: r.element_id as string,
        count: r._count.element_id,
      }));

    topElementId = topElements?.[0]?.element_id ?? null;
  }

  // 8. response
  return NextResponse.json({
    live,
    drafts,
    history,
    summary: {
      today: {
        visits: visitsToday,
        clicks: clicksToday,
        top_element_id: topElementId,
        top_elements: topElements,
        last_seen_at: lastStarted
          ? lastStarted.toISOString()
          : null,
      },
      plan: {
        tier: user.plan_id,
        replay_enabled: replayEnabled,
      },
    },
  });
}
