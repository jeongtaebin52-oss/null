import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { simplifyGhostPoints, type GhostClick, type GhostPoint } from "@/lib/ghost-utils";

const MIN_DURATION_SEC = 3;
const MAX_POINTS = 120;
const MAX_TRACES = 2;

/** 클라이언트 재생 포맷 (기존 trace_json과 동일) */
export type GhostTraceReplay = {
  trace_id: string;
  points: GhostPoint[];
  clicks: GhostClick[];
  meta: { dur: number; score: number };
};

function scoreTrace(durationSec: number, clicksCount: number) {
  // TODO(정책확정 필요): 점수 가중치(체류/클릭/CTA) 튜닝.
  return Math.min(durationSec, 300) + clicksCount * 8;
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

  const simplified = simplifyGhostPoints(params.points, MAX_POINTS);
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
  // select만 사용해 clicks 컬럼을 요청하지 않음 → 배포 DB에 clicks 미존재 시에도 동작
  const traces = await prisma.ghostTrace.findMany({
    where: { page_id: pageId },
    orderBy: [{ score: "desc" }, { created_at: "desc" }],
    take: MAX_TRACES,
    select: {
      trace_id: true,
      duration_ms: true,
      score: true,
      points: { orderBy: { seq: "asc" as const }, select: { t: true, x: true, y: true } },
    },
  });

  return traces.map((trace) => ({
    trace_id: trace.trace_id,
    points: trace.points.map((p) => ({ t: p.t, x: p.x, y: p.y })),
    clicks: [] as GhostClick[],
    meta: {
      dur: trace.duration_ms / 1000,
      score: trace.score,
    },
  }));
}
