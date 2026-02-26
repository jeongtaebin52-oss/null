import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: Request, context: { params: Promise<{ pageId: string }> }) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff"] });
  if (!gate.ok) return gate.response;

  const { pageId } = await context.params;
  const now = new Date();

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        reason: z.string().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;

  const reasonRaw = typeof parsed.data.reason === "string" ? parsed.data.reason : "";
  const reason = reasonRaw.trim().slice(0, 500) || "admin_hide";

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      is_hidden: true,
      hidden_at: now,
      hidden_reason: reason,
      hidden_by_admin_id: gate.admin.id,
    },
  });

  await logAdminAudit({
    adminId: gate.admin.id,
    action: "page_hide",
    targetType: "page",
    targetId: pageId,
    req,
    meta: { reason },
  });

  return NextResponse.json({ ok: true, page });
}
