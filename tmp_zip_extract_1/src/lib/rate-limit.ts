/**
 * 단순 in-memory IP별 rate limit.
 * 단일 인스턴스 기준으로만 동작 (다중 서버 시 Redis 등으로 교체 필요).
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1분
const DEFAULT_MAX = 20;

function getWindowKey(ip: string, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return `${ip}:${windowStart}`;
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

/**
 * @param req Request
 * @param maxPerWindow 최대 허용 횟수 (기본 20)
 * @param windowMs 윈도우 길이 ms (기본 60_000)
 * @returns true면 허용, false면 초과
 */
export function checkRateLimit(
  req: Request,
  maxPerWindow = DEFAULT_MAX,
  windowMs = WINDOW_MS
): boolean {
  const ip = getClientIp(req);
  const key = getWindowKey(ip, windowMs);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return true;
  }

  if (entry.count >= maxPerWindow) return false;
  entry.count += 1;
  return true;
}

/** 주기적으로 오래된 키 정리 (선택 호출) */
export function pruneRateLimitStore() {
  const now = Date.now();
  for (const [key, v] of store.entries()) {
    if (now > v.resetAt) store.delete(key);
  }
}
