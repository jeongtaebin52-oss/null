import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "open";
  const take = Math.min(Number(url.searchParams.get("take") ?? "50") || 50, 200);

  const reports = await prisma.report.findMany({
    where: { status: status as any },
    orderBy: { created_at: "desc" },
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
