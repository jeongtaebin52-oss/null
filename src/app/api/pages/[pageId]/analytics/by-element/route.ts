import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * §31.4 영역/요소 단위 집계.
 * GET ?period=7d|30d → { by_element: { element_id: string | null, clicks: number }[] }
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

  const rows = await prisma.$queryRaw<{ element_id: string | null; c: bigint }[]>`
    SELECT "element_id", count(*)::bigint AS c
    FROM "Event"
    WHERE "page_id" = ${pageId} AND "type" = 'click' AND "ts" >= ${from}
    GROUP BY "element_id"
    ORDER BY c DESC
  `;

  const by_element = rows.map((r) => ({
    element_id: r.element_id,
    clicks: Number(r.c),
  }));

  return NextResponse.json({ period, by_element });
}
