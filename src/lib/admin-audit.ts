import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClientIp, hashIp } from "@/lib/request";

export type AdminAuditInput = {
  adminId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  req?: Request;
  meta?: Prisma.InputJsonValue | null;
};

export async function logAdminAudit({ adminId, action, targetType, targetId, req, meta }: AdminAuditInput) {
  try {
    let ipHash: string | null = null;
    let userAgent: string | null = null;
    if (req) {
      const ip = getClientIp(req);
      if (ip) ipHash = hashIp(ip);
      const ua = req.headers.get("user-agent");
      userAgent = ua ? ua.slice(0, 300) : null;
    }

    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId ?? null,
        action,
        target_type: targetType ?? null,
        target_id: targetId ?? null,
        ip_hash: ipHash,
        user_agent: userAgent,
        meta: meta ?? undefined,
      },
    });
  } catch {
    // Best-effort only.
  }
}
