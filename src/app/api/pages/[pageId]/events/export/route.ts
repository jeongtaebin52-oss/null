import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { pageId: string };

/**
 * §31.10 이벤트 로그 내보내기.
 * GET ?period=today|7d|30d → CSV (timestamp, type, session_id, x, y, element_id, element_type).
 * §31.9 레이트 리밋: IP당 10회/분. 최대 10000행.
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

  const events = await prisma.event.findMany({
    where: { page_id: pageId, ts: { gte: from } },
    orderBy: { ts: "asc" },
    take: 10_000,
    select: {
      ts: true,
      type: true,
      live_session_id: true,
      x: true,
      y: true,
      element_id: true,
      element_type: true,
    },
  });

  const escape = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = "timestamp,type,session_id,x,y,element_id,element_type\n";
  const body = events
    .map(
      (e) =>
        `${e.ts.toISOString()},${e.type},${escape(e.live_session_id)},${e.x ?? ""},${e.y ?? ""},${escape(e.element_id)},${escape(e.element_type)}`
    )
    .join("\n");
  const csv = "\uFEFF" + header + body;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="events-${pageId.slice(0, 8)}-${period}.csv"`,
    },
  });
}

