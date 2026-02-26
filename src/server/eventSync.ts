/**
 * Redis -> PG 이벤트 배치 동기화
 * REDIS_URL 있을 때만 동작. replay/spikes/library는 PG Event를 그대로 조회.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getRedis,
  EVENTS_PENDING_KEY,
  EVENTS_PROCESSING_KEY,
  EVENTS_RETRY_ZSET_KEY,
  EVENTS_DEAD_KEY,
  type EventPayload,
} from "@/lib/redis";
import { logWithThrottle } from "@/lib/logger";

const BATCH_SIZE = 100;
const INTERVAL_MS = 2000;
const REQUEUE_BATCH_SIZE = 200;
const MAX_RETRY_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;

const ALLOWED_EVENT_TYPES = new Set<EventPayload["type"]>(["enter", "leave", "move", "click", "scroll", "error", "custom"]);

type ParsedPayload = { payload: EventPayload | null; attempts: number };

function parsePayload(raw: string): ParsedPayload {
  let attempts = 0;
  try {
    const data = JSON.parse(raw) as unknown;
    let event = data as unknown;

    if (data && typeof data === "object" && "event" in data) {
      const envelope = data as { event?: unknown; meta?: { attempts?: unknown } };
      event = envelope.event;
      if (envelope.meta && typeof envelope.meta.attempts === "number") {
        attempts = envelope.meta.attempts;
      }
    }

    if (
      event &&
      typeof event === "object" &&
      "page_id" in event &&
      "live_session_id" in event &&
      "type" in event
    ) {
      const p = event as Record<string, unknown>;
      return {
        payload: {
          event_id: typeof p.event_id === "string" && p.event_id.length > 0 ? p.event_id : null,
          page_id: String(p.page_id),
          live_session_id: String(p.live_session_id),
          type: (typeof p.type === "string" && ALLOWED_EVENT_TYPES.has(p.type as EventPayload["type"]))
            ? (p.type as EventPayload["type"])
            : "custom",
          ts: typeof p.ts === "number" ? p.ts : null,
          x: typeof p.x === "number" ? p.x : null,
          y: typeof p.y === "number" ? p.y : null,
          element_id: typeof p.element_id === "string" ? p.element_id : null,
          element_type: typeof p.element_type === "string" ? p.element_type : null,
          element_label_hash: typeof p.element_label_hash === "string" ? p.element_label_hash : null,
          payload:
            p.payload && typeof p.payload === "object" && p.payload !== null
              ? (p.payload as Record<string, unknown>)
              : null,
        },
        attempts,
      };
    }
  } catch (error) {
    logWithThrottle("warn", "eventSync:parse", "eventSync parse payload failed", {
      error: String(error),
    });
  }
  return { payload: null, attempts };
}

function calcBackoffMs(attempts: number) {
  const pow = Math.max(0, attempts - 1);
  const backoff = BASE_BACKOFF_MS * Math.pow(2, pow);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

async function requeueDueRetries(redis: NonNullable<ReturnType<typeof getRedis>>) {
  try {
    const now = Date.now();
    const due = await redis.zrangebyscore(
      EVENTS_RETRY_ZSET_KEY,
      0,
      now,
      "LIMIT",
      0,
      REQUEUE_BATCH_SIZE,
    );
    if (!due.length) return;
    for (const raw of due) {
      try {
        await redis.zrem(EVENTS_RETRY_ZSET_KEY, raw);
        await redis.rpush(EVENTS_PENDING_KEY, raw);
      } catch (error) {
        logWithThrottle("warn", "eventSync:retry:move", "eventSync retry move failed", {
          error: String(error),
        });
      }
    }
  } catch (error) {
    logWithThrottle("warn", "eventSync:retry:scan", "eventSync retry scan failed", {
      error: String(error),
    });
  }
}

async function drainBatch(redis: NonNullable<ReturnType<typeof getRedis>>, prisma: PrismaClient) {
  await requeueDueRetries(redis);

  // Requeue stuck items from processing to pending to prevent silent loss.
  for (let i = 0; i < REQUEUE_BATCH_SIZE; i++) {
    try {
      const raw = await redis.rpoplpush(EVENTS_PROCESSING_KEY, EVENTS_PENDING_KEY);
      if (!raw) break;
    } catch (error) {
      logWithThrottle("warn", "eventSync:processing:requeue", "eventSync processing requeue failed", {
        error: String(error),
      });
      break;
    }
  }

  for (let i = 0; i < BATCH_SIZE; i++) {
    let raw: string | null = null;
    try {
      raw = await redis.rpoplpush(EVENTS_PENDING_KEY, EVENTS_PROCESSING_KEY);
    } catch (error) {
      logWithThrottle("warn", "eventSync:pending:pop", "eventSync pending pop failed", {
        error: String(error),
      });
      // Redis not healthy; exit to avoid hot loop.
      break;
    }
    if (!raw) break;
    const parsed = parsePayload(raw);
    if (!parsed.payload) {
      try {
        await redis.lrem(EVENTS_PROCESSING_KEY, 1, raw);
      } catch (error) {
        logWithThrottle("warn", "eventSync:processing:remove", "eventSync processing remove failed", {
          error: String(error),
        });
      }
      continue;
    }
    try {
      await prisma.event.create({
        data: {
          event_id: parsed.payload.event_id ?? undefined,
          page_id: parsed.payload.page_id,
          live_session_id: parsed.payload.live_session_id,
          type: parsed.payload.type,
          x: parsed.payload.x ?? undefined,
          y: parsed.payload.y ?? undefined,
          element_id: parsed.payload.element_id ?? undefined,
          element_type: parsed.payload.element_type ?? undefined,
          element_label_hash: parsed.payload.element_label_hash ?? undefined,
          payload: (parsed.payload.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      try {
        await redis.lrem(EVENTS_PROCESSING_KEY, 1, raw);
      } catch (error) {
        logWithThrottle("warn", "eventSync:processing:remove", "eventSync processing remove failed", {
          error: String(error),
        });
      }
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code == "P2002") {
        try {
          await redis.lrem(EVENTS_PROCESSING_KEY, 1, raw);
        } catch (error) {
          logWithThrottle("warn", "eventSync:processing:remove", "eventSync processing remove failed", {
            error: String(error),
          });
        }
        continue;
      }
      logWithThrottle("warn", "eventSync:db:create", "eventSync event create failed", {
        error: String(err),
      });
      const nextAttempts = parsed.attempts + 1;
      const retryAt = Date.now() + calcBackoffMs(nextAttempts);
      const envelope = JSON.stringify({
        event: parsed.payload,
        meta: { attempts: nextAttempts, next_ts: retryAt },
      });
      let moved = false;
      try {
        if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
          await redis.rpush(EVENTS_DEAD_KEY, envelope);
        } else {
          await redis.zadd(EVENTS_RETRY_ZSET_KEY, String(retryAt), envelope);
        }
        moved = true;
      } catch (error) {
        logWithThrottle("warn", "eventSync:retry:enqueue", "eventSync retry enqueue failed", {
          error: String(error),
        });
        moved = false;
      }
      if (moved) {
        try {
          await redis.lrem(EVENTS_PROCESSING_KEY, 1, raw);
        } catch (error) {
          logWithThrottle("warn", "eventSync:processing:remove", "eventSync processing remove failed", {
            error: String(error),
          });
        }
      }
    }
  }
}

/**
 * Redis -> PG 동기화 루프 시작. REDIS_URL 없으면 아무 동작도 하지 않음.
 */
export function startEventSyncToPg(prisma: PrismaClient): void {
  const redis = getRedis();
  if (!redis) return;
  let running = false;
  setInterval(() => {
    if (running) return;
    running = true;
    void drainBatch(redis, prisma).finally(() => {
      running = false;
    });
  }, INTERVAL_MS);
}
