import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { expireStalePages } from "@/lib/expire";

export async function GET(req: Request) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff", "viewer"] });
  if (!gate.ok) return gate.response;

  await expireStalePages();

  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? "50") || 50, 200);
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? "0") || 0);
  const sortParam = url.searchParams.get("sort") ?? "expires";
  const searchQ = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const orderBy =
    sortParam === "viewers"
      ? { total_visits: "desc" as const }
      : sortParam === "clicks"
        ? { total_clicks: "desc" as const }
        : sortParam === "reports"
          ? { report_count: "desc" as const }
          : { live_expires_at: "asc" as const };

  const whereBase = { status: "live" as const, is_deleted: false };
  const where =
    searchQ.length > 0
      ? {
          ...whereBase,
          OR: [
            { id: { contains: searchQ } },
            { owner: { anon_id: { contains: searchQ } } },
          ],
        }
      : whereBase;

  const pages = await prisma.page.findMany({
    where,
    orderBy,
    take,
    skip,
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

  return NextResponse.json({ ok: true, pages, nextSkip: skip + pages.length });
}
