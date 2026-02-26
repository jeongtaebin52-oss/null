import { NextResponse } from "next/server";
import type { AdminRole } from "@prisma/client";
import { ensureAdminUser, requireAdminSession, verifyAdminKey } from "@/lib/admin-session";
import { apiErrorJson } from "@/lib/api-error";

const ADMIN_KEY_HEADER = "x-admin-key";

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_KEY);
}

export type AdminGate =
  | { ok: true; admin: { id: string; username: string; role: AdminRole; is_active: boolean } }
  | { ok: false; response: NextResponse };

export async function requireAdmin(
  req: Request,
  options?: { roles?: AdminRole[] }
): Promise<AdminGate> {
  if (!isAdminConfigured()) {
    return { ok: false, response: apiErrorJson("not_found", 404) };
  }

  const sessionGate = await requireAdminSession({ roles: options?.roles });
  if (sessionGate.ok) return { ok: true, admin: sessionGate.admin };

  if (sessionGate.code === "forbidden" || sessionGate.code === "inactive") {
    return { ok: false, response: apiErrorJson("forbidden", 403) };
  }

  const provided = req.headers.get(ADMIN_KEY_HEADER);
  if (!provided || !verifyAdminKey(provided)) {
    return { ok: false, response: apiErrorJson("forbidden", 403) };
  }

  const admin = await ensureAdminUser();
  if (!admin.is_active) {
    return { ok: false, response: apiErrorJson("forbidden", 403) };
  }
  if (options?.roles && options.roles.length > 0 && !options.roles.includes(admin.role)) {
    return { ok: false, response: apiErrorJson("forbidden", 403) };
  }

  return { ok: true, admin };
}
