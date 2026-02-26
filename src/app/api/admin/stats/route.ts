import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { expireStalePages } from "@/lib/expire";

/** 7.4.2 알림·모니터링: 열린 신고 수, LIVE 작품 수 */
export async function GET(req: Request) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff", "viewer"] });
  if (!gate.ok) return gate.response;

  await expireStalePages();

  const [open_reports, live_count] = await Promise.all([
    prisma.report.count({ where: { status: "open" } }),
    prisma.page.count({
      where: {
        status: "live",
        is_deleted: false,
        live_expires_at: { gt: new Date() },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    open_reports,
    live_count,
  });
}
