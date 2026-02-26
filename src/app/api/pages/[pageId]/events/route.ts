import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { pageId: string };

/**
 * §31.10 원천 로그: 이벤트 목록 페이지네이션.
 * GET ?limit=50&cursor= (cursor = 이벤트 id, 미지정 시 최신부터)
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const rl = await checkRateLimit(req, 30, 60_000);
  if (!rl.allowed) {
    return apiErrorJson("rate_limit", 429, "요청이 너무 많습니다.");
  }

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const cursor = url.searchParams.get("cursor") || undefined;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const events = await prisma.event.findMany({
    where: { page_id: pageId },
    orderBy: { ts: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      ts: true,
      type: true,
      x: true,
      y: true,
      element_id: true,
      element_type: true,
      payload: true,
    },
  });

  const hasMore = events.length > limit;
  const list = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? list[list.length - 1]?.id : null;

  return NextResponse.json({
    events: list.map((e) => ({
      id: e.id,
      ts: e.ts.toISOString(),
      type: e.type,
      x: e.x,
      y: e.y,
      element_id: e.element_id,
      element_type: e.element_type,
      payload: e.payload,
    })),
    next_cursor: nextCursor,
  });
}
