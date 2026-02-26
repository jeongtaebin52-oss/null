import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.6 디바이스/해상도: enter 이벤트 payload의 viewport_w 기준 구간별 방문.
 * GET ?period=7d|30d → { buckets: { name, visits }[] } (mobile <768, tablet 768-1024, desktop >1024)
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;
  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";
  if (!["7d", "30d"].includes(period)) return apiErrorJson("invalid_period", 400);

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (period === "7d" ? 6 : 29));
  from.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ vw: number | null; c: bigint }[]>`
    SELECT (payload->>'viewport_w')::int AS vw, count(*)::bigint AS c
    FROM "Event"
    WHERE "page_id" = ${pageId} AND "type" = 'enter' AND "ts" >= ${from}
      AND (payload->>'viewport_w') IS NOT NULL
    GROUP BY (payload->>'viewport_w')::int
  `;

  let mobile = 0;
  let tablet = 0;
  let desktop = 0;
  for (const r of rows) {
    const w = r.vw ?? 0;
    const n = Number(r.c);
    if (w < 768) mobile += n;
    else if (w <= 1024) tablet += n;
    else desktop += n;
  }

  const buckets = [
    { name: "모바일 (<768px)", visits: mobile },
    { name: "태블릿 (768–1024px)", visits: tablet },
    { name: "데스크톱 (>1024px)", visits: desktop },
  ];

  return NextResponse.json({ period, by_viewport: buckets });
}
