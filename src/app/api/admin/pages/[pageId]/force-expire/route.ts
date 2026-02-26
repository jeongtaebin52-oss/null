import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(req: Request, context: { params: Promise<{ pageId: string }> }) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff"] });
  if (!gate.ok) return gate.response;

  const { pageId } = await context.params;
  const now = new Date();

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      status: "expired",
      forced_expired_at: now,
      forced_by_admin_id: gate.admin.id,
    },
  });

  await logAdminAudit({
    adminId: gate.admin.id,
    action: "page_force_expire",
    targetType: "page",
    targetId: pageId,
    req,
  });

  return NextResponse.json({ ok: true, page });
}
