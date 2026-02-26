import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@prisma/client";

import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { resolvePlanFeatures } from "@/lib/plan";
import { apiErrorJson } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  await expireStalePages();

  // 1. anon user resolve
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return apiErrorJson("anon_user_id_required", 401, "anon_id가 필요합니다.");
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return apiErrorJson("user_not_found", 404);
  }

  // 2. plan / feature resolve
  const plan = await prisma.plan.findUnique({
    where: { id: user.plan_id },
  });

  const fallbackPlan: Plan = {
    id: user.plan_id,
    name: "",
    price_cents: null,
    features: {},
    created_at: new Date(),
    updated_at: new Date(),
  };
  const features = resolvePlanFeatures(plan ?? fallbackPlan);

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

  let liveList = pages.filter(
    (p) =>
      p.status === "live" &&
      p.live_expires_at !== null &&
      p.live_expires_at > now
  );
  let drafts = pages.filter((p) => p.status === "draft");
  let history = pages.filter((p) => p.status === "expired");
  const maxHistory = features.maxHistoryItems ?? 50;
  history = history.slice(0, maxHistory);

  const sortParam = req.nextUrl?.searchParams?.get("sort") ?? "recent";
  const byName = sortParam === "name";
  const sortByTitle = (a: { title: string | null }, b: { title: string | null }) =>
    (a.title ?? "").localeCompare(b.title ?? "", "ko");
  const sortByUpdated = (a: { updated_at: Date }, b: { updated_at: Date }) =>
    b.updated_at.getTime() - a.updated_at.getTime();
  if (byName) {
    liveList = [...liveList].sort(sortByTitle);
    drafts = [...drafts].sort(sortByTitle);
    history = [...history].sort(sortByTitle);
  } else {
    liveList = [...liveList].sort(sortByUpdated);
    drafts = [...drafts].sort(sortByUpdated);
    history = [...history].sort(sortByUpdated);
  }
  const live = liveList;

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

  // 8. response — §6.1 optional status filter (live/draft/expired)
  const statusParam = req.nextUrl?.searchParams?.get("status");
  const body = {
    live: statusParam === "draft" || statusParam === "expired" ? [] : live,
    drafts: statusParam === "live" || statusParam === "expired" ? [] : drafts,
    history: statusParam === "live" || statusParam === "draft" ? [] : history,
    summary: {
      today: {
        visits: visitsToday,
        clicks: clicksToday,
        top_element_id: topElementId,
        top_elements: topElements,
        last_seen_at: lastStarted ? lastStarted.toISOString() : null,
      },
      plan: {
        tier: user.plan_id,
        replay_enabled: replayEnabled,
      },
    },
  };
  return NextResponse.json(body);
}
