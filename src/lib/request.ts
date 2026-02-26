import { createHash } from "crypto";

// Enforce IP_HASH_SALT: required in production, optional with fallback in development
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.IP_HASH_SALT) {
  throw new Error("IP_HASH_SALT must be set in production environment");
}
if (!isProduction && !process.env.IP_HASH_SALT) {
  console.warn("IP_HASH_SALT is not set. Using default fallback for development.");
}

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
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex");
}
