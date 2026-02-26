import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.5 코호트·리텐션(기초): 일별 방문·참여 세션(체류 30초 이상) 수.
 * GET ?period=7d|30d → { by_day: [ { date, visits, sessions_over_30s } ] }
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

  const rows = await prisma.$queryRaw<
    { d: Date; visits: bigint; over30: bigint }[]
  >`
    SELECT date_trunc('day', "started_at")::date AS d,
           count(*)::bigint AS visits,
           count(*) FILTER (WHERE COALESCE("duration_ms", 0) >= 30000)::bigint AS over30
    FROM "LiveSession"
    WHERE "page_id" = ${pageId} AND "started_at" >= ${from}
    GROUP BY date_trunc('day', "started_at")
    ORDER BY d
  `;

  const by_day = rows.map((r) => ({
    date: (r.d instanceof Date ? r.d : new Date(r.d)).toISOString().slice(0, 10),
    visits: Number(r.visits),
    sessions_over_30s: Number(r.over30),
  }));

  return NextResponse.json({ period, by_day });
}
