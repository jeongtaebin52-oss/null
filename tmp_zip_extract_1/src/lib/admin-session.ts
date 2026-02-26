import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Admin UI session (v1)
 *
 * - Hidden route: /ops/<ADMIN_SECRET_SLUG>
 * - Login: ADMIN_KEY only (no email/phone)
 *
 * Schema requirements confirmed by runtime errors:
 * - AdminUser.username (required)
 * - AdminUser.password_hash (required)
 * - AdminSession.admin relation (required)
 *
 * TODO(정책확정 필요):
 * - Replace ADMIN_KEY-only with password + OTP login.
 * - RBAC, audit logs, forced logout, session TTL policy.
 */

const COOKIE_NAME = "null_admin_session";

function sessionSalt() {
  return process.env.ADMIN_SESSION_SALT ?? process.env.IP_HASH_SALT ?? "";
}

function hashToken(token: string) {
  return createHash("sha256").update(`${token}|${sessionSalt()}`).digest("hex");
}

function hashAdminKeyAsPasswordHash() {
  const key = process.env.ADMIN_KEY ?? "";
  return createHash("sha256").update(`admin-key|${key}|${sessionSalt()}`).digest("hex");
}

export function isAdminUiConfigured() {
  return Boolean(process.env.ADMIN_SECRET_SLUG && process.env.ADMIN_KEY);
}

export function verifyAdminKey(input: string) {
  return Boolean(process.env.ADMIN_KEY) && input === process.env.ADMIN_KEY;
}

async function ensureAdminUser() {
  let admin = await prisma.adminUser.findFirst({
    orderBy: { created_at: "asc" },
  });

  if (!admin) {
    const suffix = randomBytes(3).toString("hex");
    const username = `admin_${suffix}`;

    admin = await prisma.adminUser.create({
      data: {
        username,
        password_hash: hashAdminKeyAsPasswordHash(),
        // optional fields in schema (role/is_active/otp_secret) are intentionally omitted
        // TODO(정책확정 필요): OTP 도입 시 otp_secret 생성/저장
      },
    });
  }

  return admin;
}

export async function createAdminSession() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  // TODO(정책확정 필요): session TTL (default 7 days)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const admin = await ensureAdminUser();

  await prisma.adminSession.create({
    data: {
      token_hash: tokenHash,
      expires_at: expiresAt,
      admin: { connect: { id: admin.id } }, // REQUIRED relation
    },
  });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await prisma.adminSession.deleteMany({ where: { token_hash: tokenHash } });
  }

  jar.set(COOKIE_NAME, "", { path: "/", expires: new Date(0) });
}

export async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; code: "not_configured" | "no_session" | "expired_or_invalid" }
> {
  if (!isAdminUiConfigured()) return { ok: false, code: "not_configured" };

  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return { ok: false, code: "no_session" };

  const tokenHash = hashToken(token);

  const found = await prisma.adminSession.findFirst({
    where: {
      token_hash: tokenHash,
      expires_at: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!found) return { ok: false, code: "expired_or_invalid" };
  return { ok: true };
}
