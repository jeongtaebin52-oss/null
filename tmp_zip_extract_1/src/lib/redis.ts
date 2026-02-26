/**
 * Redis client for NULL.
 * - REDIS_URL이 있으면 연결, 없으면 no-op(쓰기/읽기 무시).
 * - Event 쓰기 경로: socket → Redis → (배치 동기화) → PG.
 */

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

export type EventPayload = {
  page_id: string;
  live_session_id: string;
  type: "enter" | "leave" | "move" | "click" | "scroll";
  x?: number | null;
  y?: number | null;
  element_id?: string | null;
  payload?: Record<string, unknown> | null;
};

/**
 * 이벤트를 Redis 대기 리스트에 추가. Redis 없으면 no-op.
 */
export function pushEvent(redis: Redis | null, data: EventPayload): void {
  if (!redis) return;
  const json = JSON.stringify(data);
  redis.rpush(EVENTS_PENDING_KEY, json).catch(() => {
    // Best-effort; 실패 시 로그만 (선택)
  });
}
