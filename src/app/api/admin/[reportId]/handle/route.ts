import { NextResponse } from "next/server";
import { z } from "zod";
import { ReportAction, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { logAdminAudit } from "@/lib/admin-audit";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: Request, context: { params: Promise<{ reportId: string }> }) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff"] });
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        status: z.string().optional(),
        action: z.string().optional(),
        admin_note: z.string().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const { reportId } = await context.params;
  const adminNote = typeof body.admin_note === "string" ? body.admin_note.slice(0, 2000) : null;
  const action =
    typeof body.action === "string" && Object.values(ReportAction).includes(body.action as ReportAction)
      ? (body.action as ReportAction)
      : "none";
  const status =
    typeof body.status === "string" && Object.values(ReportStatus).includes(body.status as ReportStatus)
      ? (body.status as ReportStatus)
      : "resolved";

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      abuses: { take: 1, orderBy: { created_at: "desc" } },
      page: true,
    },
  });
  if (!report) return apiErrorJson("not_found", 404);

  const now = new Date();

  if (action === "hide_page") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: {
        is_hidden: true,
        hidden_at: now,
        hidden_reason: report.reason ?? "reported",
        hidden_by_admin_id: gate.admin.id,
      },
    });
  }

  if (action === "force_expire") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: {
        status: "expired",
        forced_expired_at: now,
        forced_by_admin_id: gate.admin.id,
      },
    });
  }

  if (action === "ban_ip") {
    const abuse = report.abuses?.[0];
    if (abuse?.ip_hash) {
      // 정책확정: 신고 기반 IP 차단 시 30일 만료.
      const IP_BLOCK_DAYS = 30;
      const expiresAt = new Date(Date.now() + IP_BLOCK_DAYS * 24 * 60 * 60 * 1000);
      await prisma.ipBlock.upsert({
        where: { ip_hash: abuse.ip_hash },
        update: {
          reason: adminNote ?? "report-ban",
          expires_at: expiresAt,
        },
        create: {
          ip_hash: abuse.ip_hash,
          reason: adminNote ?? "report-ban",
          expires_at: expiresAt,
        },
      });
    }
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      action,
      admin_note: adminNote,
      handled_at: now,
      handled_by_admin_id: gate.admin.id,
    },
  });

  await logAdminAudit({
    adminId: gate.admin.id,
    action: "report_handle",
    targetType: "report",
    targetId: reportId,
    req,
    meta: { action, status },
  });

  return NextResponse.json({ ok: true, report: updated });
}
