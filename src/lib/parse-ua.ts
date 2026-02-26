/**
 * §31.6 OS/브라우저 집계용 간단 UA 파서 (라이브러리 없이).
 * by-browser, by-os API에서 사용.
 */
export function parseBrowser(ua: string): string {
  if (!ua) return "기타";
  const u = ua.toLowerCase();
  if (u.includes("edg/")) return "Edge";
  if (u.includes("chrome") && !u.includes("chromium")) return "Chrome";
  if (u.includes("firefox") || u.includes("fxios")) return "Firefox";
  if (u.includes("safari") && !u.includes("chrome")) return "Safari";
  if (u.includes("opr/") || u.includes("opera")) return "Opera";
  if (u.includes("msie") || u.includes("trident")) return "IE";
  return "기타";
}

export function parseOS(ua: string): string {
  if (!ua) return "기타";
  const u = ua.toLowerCase();
  if (u.includes("windows")) return "Windows";
  if (u.includes("mac os") || u.includes("macos")) return "macOS";
  if (u.includes("iphone") || u.includes("ipad")) return "iOS";
  if (u.includes("android")) return "Android";
  if (u.includes("linux")) return "Linux";
  return "기타";
}
