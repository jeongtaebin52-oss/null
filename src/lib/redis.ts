/**
 * Redis client for NULL.
 * - REDIS_URL이 있으면 연결, 없으면 no-op(쓰기/읽기 무시).
 * - Event 쓰기 경로: socket → Redis → (배치 동기화) → PG.
 */

import { randomUUID } from "crypto";
import Redis from "ioredis";

let client: Redis | null = null;

function getRedisUrl(): string | undefined {
  const url = process.env.REDIS_URL;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

/**
 * Redis 클라이언트 반환. REDIS_URL 없으면 null.
 */
export function getRedis(): Redis | null {
  if (client !== null) return client;
  const url = getRedisUrl();
  if (!url) return null;
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    return client;
  } catch {
    return null;
  }
}

/** 배치 동기화용 대기 리스트 키 */
export const EVENTS_PENDING_KEY = "events:pending";
/** 배치 동기화용 처리 리스트 키 (유실 방지/재시도) */
export const EVENTS_PROCESSING_KEY = "events:processing";
/** 재시도 대기(ZSET) */
export const EVENTS_RETRY_ZSET_KEY = "events:retry";
/** 데드레터 큐 */
export const EVENTS_DEAD_KEY = "events:dead";

export type EventPayload = {
  event_id?: string | null;
  page_id: string;
  live_session_id: string;
  type: "enter" | "leave" | "move" | "click" | "scroll" | "error" | "custom";
  ts?: number | null;
  x?: number | null;
  y?: number | null;
  element_id?: string | null;
  element_type?: string | null;
  element_label_hash?: string | null;
  payload?: Record<string, unknown> | null;
};

function ensureEventId(data: EventPayload): EventPayload {
  if (data.event_id && typeof data.event_id === "string") {
    return data;
  }
  return { ...data, event_id: `ev_${randomUUID()}` };
}

/**
 * 이벤트를 Redis 대기 리스트에 추가. Redis 없으면 no-op.
 */
export function pushEvent(redis: Redis | null, data: EventPayload): void {
  if (!redis) return;
  const json = JSON.stringify(ensureEventId(data));
  redis.rpush(EVENTS_PENDING_KEY, json).catch(() => {
    // Best-effort; 실패 시 로그만 (선택)
  });
}
