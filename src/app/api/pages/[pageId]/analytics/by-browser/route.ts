import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { parseBrowser } from "../../../../../../lib/parse-ua";

type Params = { pageId: string };

/**
 * §31.6 OS/브라우저: enter 이벤트 payload.ua 기준 브라우저별 방문.
 * GET ?period=7d|30d → { by_browser: { name: string, visits: number }[] }
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

  const rows = await prisma.$queryRaw<{ ua: string | null }[]>`
    SELECT payload->>'ua' AS ua FROM "Event"
    WHERE "page_id" = ${pageId} AND "type" = 'enter' AND "ts" >= ${from}
      AND (payload->>'ua') IS NOT NULL AND (payload->>'ua') != ''
  `;

  const countByBrowser: Record<string, number> = {};
  for (const r of rows) {
    const name = parseBrowser(r.ua ?? "");
    countByBrowser[name] = (countByBrowser[name] ?? 0) + 1;
  }
  const by_browser = Object.entries(countByBrowser)
    .map(([name, visits]) => ({ name, visits }))
    .sort((a, b) => b.visits - a.visits);

  return NextResponse.json({ period, by_browser });
}
