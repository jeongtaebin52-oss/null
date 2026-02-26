import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { compressHolds, simplifyGhostPoints, type GhostClick, type GhostPoint } from "@/lib/ghost-utils";

const MIN_DURATION_SEC = 3;
const MAX_POINTS = 120;
const MAX_TRACES = 2;
const SCORE_DURATION_CAP_SEC = 300;
const SCORE_CLICK_WEIGHT = 8;

/** Ghost trace replay payload. */
export type GhostTraceReplay = {
  trace_id: string;
  points: GhostPoint[];
  clicks: GhostClick[];
  meta: { dur: number; score: number };
};

function scoreTrace(durationSec: number, clicksCount: number) {
  return Math.min(durationSec, SCORE_DURATION_CAP_SEC) + clicksCount * SCORE_CLICK_WEIGHT;
}

export async function storeGhostTrace(params: {
  pageId: string;
  points: GhostPoint[];
  clicks: GhostClick[];
  durationMs: number;
}) {
  const durationSec = params.durationMs / 1000;
  if (durationSec < MIN_DURATION_SEC || params.points.length < 2) {
    return null;
  }

  const compressed = compressHolds(params.points, 0.5, 0.01);
  const simplified = simplifyGhostPoints(compressed, MAX_POINTS);
  if (simplified.length < 2) {
    return null;
  }

  const score = scoreTrace(durationSec, params.clicks.length);
  const traceId = `trace_${randomUUID()}`;

  const created = await prisma.ghostTrace.create({
    data: {
      page_id: params.pageId,
      trace_id: traceId,
      score,
      duration_ms: Math.round(params.durationMs),
      clicks_count: params.clicks.length,
      points_count: simplified.length,
      clicks: params.clicks,
      points: {
        create: simplified.map((p, i) => ({
          seq: i,
          t: p.t,
          x: p.x,
          y: p.y,
        })),
      },
    },
  });

  const traces = await prisma.ghostTrace.findMany({
    where: { page_id: params.pageId },
    orderBy: [{ score: "desc" }, { created_at: "desc" }],
  });

  const keep = traces.slice(0, MAX_TRACES).map((trace) => trace.id);
  if (keep.length > 0) {
    await prisma.ghostTrace.deleteMany({
      where: {
        page_id: params.pageId,
        id: { notIn: keep },
      },
    });
  }

  return created;
}

export async function getGhostTraces(pageId: string): Promise<GhostTraceReplay[]> {
  const traces = await prisma.ghostTrace.findMany({
    where: { page_id: pageId },
    orderBy: [{ score: "desc" }, { created_at: "desc" }],
    take: MAX_TRACES,
    select: {
      trace_id: true,
      duration_ms: true,
      score: true,
      clicks: true,
      points: { orderBy: { seq: "asc" as const }, select: { t: true, x: true, y: true } },
    },
  });

  return traces.map((trace) => {
    let clicks: GhostClick[] = [];
    if (trace.clicks && Array.isArray(trace.clicks)) {
      clicks = (trace.clicks as unknown[]).map((c) => {
        const o = c as Record<string, unknown>;
        return {
          t: typeof o.t === "number" ? o.t : 0,
          x: typeof o.x === "number" ? o.x : 0,
          y: typeof o.y === "number" ? o.y : 0,
          el: typeof o.el === "string" ? o.el : undefined,
        };
      });
    }
    return {
      trace_id: trace.trace_id,
      points: trace.points.map((p) => ({ t: p.t, x: p.x, y: p.y })),
      clicks,
      meta: {
        dur: trace.duration_ms / 1000,
        score: trace.score,
      },
    };
  });
}
