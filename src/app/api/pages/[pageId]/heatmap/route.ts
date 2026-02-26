import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { pageId: string };

const GRID_SIZE = 16;

/**
 * §31.4 클릭 히트맵 기초.
 * GET ?period=today|7d|30d → { grid: number[][], size: number }.
 * §31.9 레이트 리밋: IP당 30회/분.
 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const rl = await checkRateLimit(req, 30, 60_000);
  if (!rl.allowed) {
    return apiErrorJson("rate_limit", 429, {
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      headers: { "X-RateLimit-Remaining": "0" },
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

  const urlObj = new URL(req.url);
  const heatmapType = urlObj.searchParams.get("type") || "click";

  if (heatmapType === "move") {
    const moveEvents = await prisma.event.findMany({
      where: {
        page_id: pageId,
        type: "move",
        ts: { gte: from },
        x: { not: null },
        y: { not: null },
      },
      select: { x: true, y: true },
    });
    const moveGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const e of moveEvents) {
      const x = e.x ?? 0;
      const y = e.y ?? 0;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      const col = Math.min(GRID_SIZE - 1, Math.floor(x * GRID_SIZE));
      const row = Math.min(GRID_SIZE - 1, Math.floor(y * GRID_SIZE));
      moveGrid[row][col]++;
    }
    return NextResponse.json({ grid: moveGrid, size: GRID_SIZE });
  }

  if (heatmapType === "scroll") {
    const scrollEvents = await prisma.event.findMany({
      where: {
        page_id: pageId,
        type: "scroll",
        ts: { gte: from },
        x: { not: null },
      },
      select: { x: true },
    });
    const scrollBuckets = Array(GRID_SIZE).fill(0);
    for (const e of scrollEvents) {
      const depth = e.x ?? 0;
      if (depth < 0 || depth > 1) continue;
      const i = Math.min(GRID_SIZE - 1, Math.floor(depth * GRID_SIZE));
      scrollBuckets[i]++;
    }
    return NextResponse.json({ scrollBuckets, size: GRID_SIZE });
  }

  const compare = urlObj.searchParams.get("compare") === "1" && period !== "today";
  const days = period === "7d" ? 7 : 30;
  const previousTo = new Date(from);
  previousTo.setMilliseconds(-1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - days + 1);
  previousFrom.setHours(0, 0, 0, 0);

  const [events, previousEvents] = await Promise.all([
    prisma.event.findMany({
      where: {
        page_id: pageId,
        type: "click",
        ts: { gte: from },
        x: { not: null },
        y: { not: null },
      },
      select: { x: true, y: true },
    }),
    compare
      ? prisma.event.findMany({
          where: {
            page_id: pageId,
            type: "click",
            ts: { gte: previousFrom, lte: previousTo },
            x: { not: null },
            y: { not: null },
          },
          select: { x: true, y: true },
        })
      : Promise.resolve([]),
  ]);

  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  for (const e of events) {
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    const col = Math.min(GRID_SIZE - 1, Math.floor(x * GRID_SIZE));
    const row = Math.min(GRID_SIZE - 1, Math.floor(y * GRID_SIZE));
    grid[row][col]++;
  }

  let previous_grid: number[][] | undefined;
  if (compare && previousEvents.length >= 0) {
    previous_grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const e of previousEvents) {
      const x = e.x ?? 0;
      const y = e.y ?? 0;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      const col = Math.min(GRID_SIZE - 1, Math.floor(x * GRID_SIZE));
      const row = Math.min(GRID_SIZE - 1, Math.floor(y * GRID_SIZE));
      previous_grid[row][col]++;
    }
  }

  return NextResponse.json(
    previous_grid != null ? { grid, size: GRID_SIZE, previous_grid } : { grid, size: GRID_SIZE }
  );
}

