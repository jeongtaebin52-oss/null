import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

type HandleBody = {
  status?: "resolved" | "dismissed";
  action?: "none" | "hide_page" | "force_expire" | "ban_ip";
  admin_note?: string;
  // TODO(정책확정 필요): suspend_owner 등 추가 조치.
};

export async function POST(req: Request, context: { params: Promise<{ reportId: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: HandleBody = {};
  try {
    body = (await req.json()) as HandleBody;
  } catch {
    body = {};
  }

  const { reportId } = await context.params;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { page: true, abuses: { take: 1, orderBy: { created_at: "desc" } } },
  });
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  const status = body.status ?? "resolved";
  const action = body.action ?? "none";
  const adminNote = typeof body.admin_note === "string" ? body.admin_note.slice(0, 2000) : null;

  if (action === "hide_page") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: {
        is_hidden: true,
        hidden_at: now,
        hidden_reason: report.reason ?? "reported",
      },
    });
  }

  if (action === "force_expire") {
    await prisma.page.update({
      where: { id: report.page_id },
      data: {
        status: "expired",
        forced_expired_at: now,
      },
    });
  }

  if (action === "ban_ip") {
    const abuse = report.abuses?.[0];
    if (abuse?.ip_hash) {
      await prisma.ipBlock.upsert({
        where: { ip_hash: abuse.ip_hash },
        update: {
          reason: adminNote ?? "report-ban",
          // TODO(정책확정 필요): 차단 만료 기간 정책(예: 7일) 결정.
          expires_at: null,
        },
        create: {
          ip_hash: abuse.ip_hash,
          reason: adminNote ?? "report-ban",
          // TODO(정책확정 필요): 차단 만료 기간 정책(예: 7일) 결정.
          expires_at: null,
        },
      });
    }
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: status as any,
      action: action as any,
      admin_note: adminNote,
      handled_at: now,
    },
  });

  return NextResponse.json({ ok: true, report: updated });
}
