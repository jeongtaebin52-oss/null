import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ReportStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff", "viewer"] });
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "open";
  const status =
    Object.values(ReportStatus).includes(statusParam as ReportStatus) ? (statusParam as ReportStatus) : "open";
  const sort = url.searchParams.get("sort") ?? "date";
  const take = Math.min(Number(url.searchParams.get("take") ?? "50") || 50, 200);

  /** §29.8 신고 큐 정렬: 접수일(created_at) | 우선순위(page report_count 내림차순 후 접수일) */
  const orderBy =
    sort === "priority"
      ? [{ page: { report_count: "desc" as const } }, { created_at: "desc" as const }]
      : [{ created_at: "desc" as const }];

  const reports = await prisma.report.findMany({
    where: { status },
    orderBy,
    take,
    include: {
      page: {
        select: {
          id: true,
          title: true,
          status: true,
          is_hidden: true,
          live_expires_at: true,
          report_count: true,
        },
      },
    },
  });

  return NextResponse.json({ ok: true, reports });
}
