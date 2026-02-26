/**
 * Redis → PG 이벤트 배치 동기화.
 * REDIS_URL이 있을 때만 동작. replay/spikes/library는 PG Event를 그대로 조회.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { getRedis, EVENTS_PENDING_KEY, type EventPayload } from "@/lib/redis";

const BATCH_SIZE = 100;
const INTERVAL_MS = 2000;

function parsePayload(raw: string): EventPayload | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "page_id" in data &&
      "live_session_id" in data &&
      "type" in data
    ) {
      const p = data as Record<string, unknown>;
      return {
        page_id: String(p.page_id),
        live_session_id: String(p.live_session_id),
        type: p.type as EventPayload["type"],
        x: typeof p.x === "number" ? p.x : null,
        y: typeof p.y === "number" ? p.y : null,
        element_id: typeof p.element_id === "string" ? p.element_id : null,
        payload:
          p.payload && typeof p.payload === "object" && p.payload !== null
            ? (p.payload as Record<string, unknown>)
            : null,
      };
    }
  } catch {
    // skip malformed
  }
  return null;
}

async function drainBatch(redis: NonNullable<ReturnType<typeof getRedis>>, prisma: PrismaClient) {
  for (let i = 0; i < BATCH_SIZE; i++) {
    const raw = await redis.lpop(EVENTS_PENDING_KEY);
    if (!raw) break;
    const payload = parsePayload(raw);
    if (!payload) continue;
    try {
      await prisma.event.create({
        data: {
          page_id: payload.page_id,
          live_session_id: payload.live_session_id,
          type: payload.type,
          x: payload.x ?? undefined,
          y: payload.y ?? undefined,
          element_id: payload.element_id ?? undefined,
          payload: (payload.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      // Best-effort; 실패 시 해당 이벤트는 유실 (재시도 없음)
    }
  }
}

/**
 * Redis → PG 동기화 루프 시작. REDIS_URL 없으면 아무것도 하지 않음.
 */
export function startEventSyncToPg(prisma: PrismaClient): void {
  const redis = getRedis();
  if (!redis) return;
  setInterval(() => {
    void drainBatch(redis, prisma);
  }, INTERVAL_MS);
}
