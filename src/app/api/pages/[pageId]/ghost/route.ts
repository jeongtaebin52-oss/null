import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getGhostTraces, storeGhostTrace } from "@/lib/ghost";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";
import type { GhostClick, GhostPoint } from "@/lib/ghost-utils";

type Params = { pageId: string };

const GHOST_POST_MAX_PER_MINUTE = 10;

function parsePoints(raw: unknown): GhostPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (p && typeof p === "object" && "t" in p && "x" in p && "y" in p) {
        const o = p as Record<string, unknown>;
        const t = typeof o.t === "number" ? o.t : 0;
        const x = typeof o.x === "number" ? Math.min(1, Math.max(0, o.x)) : 0;
        const y = typeof o.y === "number" ? Math.min(1, Math.max(0, o.y)) : 0;
        return { t, x, y };
      }
      return null;
    })
    .filter((p): p is GhostPoint => p !== null);
}

function parseClicks(raw: unknown): GhostClick[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (c && typeof c === "object" && "t" in c && "x" in c && "y" in c) {
        const o = c as Record<string, unknown>;
        const t = typeof o.t === "number" ? o.t : 0;
        const x = typeof o.x === "number" ? Math.min(1, Math.max(0, o.x)) : 0;
        const y = typeof o.y === "number" ? Math.min(1, Math.max(0, o.y)) : 0;
        const el = typeof o.el === "string" ? o.el : undefined;
        return el ? { t, x, y, el } : { t, x, y };
      }
      return null;
    })
    .filter((c): c is GhostClick => c !== null);
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });

  if (!page || page.is_deleted) {
    return apiErrorJson("not_found", 404);
  }

  const anonUserId = await resolveAnonUserId(req);
  const isOwner = anonUserId && page.owner.anon_id === anonUserId;

  if (!isOwner) {
    if (page.status !== "live") return apiErrorJson("not_found", 404);
    if (page.live_expires_at && page.live_expires_at <= new Date()) {
      return apiErrorJson("not_found", 404);
    }
  }

  const traces = await getGhostTraces(pageId);
  return NextResponse.json({ traces });
}

/** §5.2 잔상 저장: POST body { points, clicks, duration_ms } (서버 disconnect 시에는 socket에서 저장) */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  const rl = await checkRateLimit(req, GHOST_POST_MAX_PER_MINUTE);
  if (!rl.allowed) {
    return apiErrorJson("too_many_requests", 429, {
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      headers: rateLimitHeaders(rl),
    });
  }

  await expireStalePages();
  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });

  if (!page || page.is_deleted) {
    return apiErrorJson("not_found", 404);
  }

  const anonUserId = await resolveAnonUserId(req);
  const isOwner = anonUserId && page.owner.anon_id === anonUserId;
  if (!isOwner) {
    if (page.status !== "live") return apiErrorJson("not_found", 404);
    if (page.live_expires_at && page.live_expires_at <= new Date()) {
      return apiErrorJson("not_found", 404);
    }
  }

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        points: z.unknown().optional(),
        clicks: z.unknown().optional(),
        duration_ms: z.number().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;

  const durationMs = typeof parsed.data.duration_ms === "number" ? Math.max(0, parsed.data.duration_ms) : 0;
  const points = parsePoints(parsed.data.points);
  const clicks = parseClicks(parsed.data.clicks);

  const stored = await storeGhostTrace({ pageId, points, clicks, durationMs });
  if (!stored) {
    return apiErrorJson("trace_not_stored", 200, {
      message: "trace_not_stored",
      extra: { traces: await getGhostTraces(pageId) },
    });
  }

  const traces = await getGhostTraces(pageId);
  return NextResponse.json({ traces }, { status: 201 });
}
