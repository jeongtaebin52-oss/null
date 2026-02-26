import { NextResponse } from "next/server";

/**
 * Admin auth is intentionally simple for v1.
 *
 * - The *UI route* is hidden by secret slug (PART 3).
 * - The *API endpoints* are protected by a static admin key header.
 *
 * TODO(정책확정 필요):
 * - Replace with proper admin login (password + OTP) and AdminSession persistence.
 * - Consider RBAC by AdminRole.
 */

const ADMIN_KEY_HEADER = "x-admin-key";

export function isAdminConfigured() {
  // If no key is configured, admin should be effectively unreachable.
  return Boolean(process.env.ADMIN_KEY);
}

export function requireAdmin(req: Request) {
  if (!isAdminConfigured()) {
    // Hide existence when not configured.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const provided = req.headers.get(ADMIN_KEY_HEADER);
  if (!provided || provided !== process.env.ADMIN_KEY) {
    // Prefer 403 to avoid auth probing semantics.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return null;
}
