import { createHash } from "crypto";

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    return first?.trim() ?? null;
  }

  const realIp = req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip");
  return realIp ?? null;
}

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "";
  // TODO(정책확정 필요): 운영 환경에서는 IP_HASH_SALT 필수.
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}
