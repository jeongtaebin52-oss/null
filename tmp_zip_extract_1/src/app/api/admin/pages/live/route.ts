import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { expireStalePages } from "@/lib/expire";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  await expireStalePages();

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? "50") || 50, 200);

  const pages = await prisma.page.findMany({
    where: { status: "live", is_deleted: false },
    orderBy: { live_expires_at: "asc" },
    take,
    select: {
      id: true,
      title: true,
      anon_number: true,
      owner_id: true,
      status: true,
      is_hidden: true,
      live_started_at: true,
      live_expires_at: true,
      total_visits: true,
      total_clicks: true,
      avg_duration_ms: true,
      upvote_count: true,
      report_count: true,
      created_at: true,
      updated_at: true,
      owner: { select: { anon_id: true } },
    },
  });

  return NextResponse.json({ ok: true, pages });
}
