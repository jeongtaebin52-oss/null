/**
 * IP rate limit.
 * Uses Redis when available; falls back to in-memory for local/dev.
 */

import { getRedis } from "@/lib/redis";
import { logWithThrottle } from "@/lib/logger";

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 20;
const REDIS_KEY_PREFIX = "rate_limit";

function getWindowKey(ip: string, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return `${ip}:${windowStart}`;
}

function getRedisWindowKey(ip: string, windowMs: number, windowStart: number) {
  return `${REDIS_KEY_PREFIX}:${windowMs}:${windowStart}:${ip}`;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
};

/**
 * @param req Request
 * @param maxPerWindow max allowed count per window (default 20)
 * @param windowMs window size in ms (default 60_000)
 * @returns { allowed, remaining, limit, resetAt }
 */
export async function checkRateLimit(
  req: Request,
  maxPerWindow = DEFAULT_MAX,
  windowMs = WINDOW_MS
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;

  const redis = getRedis();
  if (redis) {
    try {
      const key = getRedisWindowKey(ip, windowMs, windowStart);
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs + 1000);
      }
      const remaining = Math.max(0, maxPerWindow - count);
      return { allowed: count <= maxPerWindow, remaining, limit: maxPerWindow, resetAt };
    } catch (error) {
      logWithThrottle("warn", "rateLimit:redis", "rate limit redis failed", {
        error: String(error),
      });
    }
  }

  const key = getWindowKey(ip, windowMs);
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxPerWindow - 1, limit: maxPerWindow, resetAt: entry.resetAt };
  }

  if (entry.count >= maxPerWindow) {
    return { allowed: false, remaining: 0, limit: maxPerWindow, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxPerWindow - entry.count, limit: maxPerWindow, resetAt: entry.resetAt };
}

/** rate limit headers for Response */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)) }),
  };
}

/** Periodic cleanup for in-memory fallback */
export function pruneRateLimitStore() {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (now > v.resetAt) store.delete(key);
  }
}
