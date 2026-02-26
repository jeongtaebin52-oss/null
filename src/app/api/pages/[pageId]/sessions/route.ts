import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31 대시보드: 최근 세션 목록 (리플레이 진입 전 활동 요약).
 * GET ?limit=5 → { sessions: { id, started_at, duration_ms, ended_at }[] }
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "5", 10) || 5));
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;
  const hasRange = from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime());

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) {
    return apiErrorJson("forbidden", 403);
  }

  const sessions = await prisma.liveSession.findMany({
    where: {
      page_id: pageId,
      ...(hasRange && from && to
        ? { started_at: { gte: from, lte: to } }
        : {}),
    },
    orderBy: { started_at: "desc" },
    take: limit,
    select: {
      id: true,
      started_at: true,
      ended_at: true,
      duration_ms: true,
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      started_at: s.started_at.toISOString(),
      ended_at: s.ended_at?.toISOString() ?? null,
      duration_ms: s.duration_ms,
    })),
  });
}
