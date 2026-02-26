import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";

type Params = { pageId: string };

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      current_version: true,
      owner: true,
    },
  });

  if (!page || page.is_deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const anonUserId = await resolveAnonUserId(req);
  const isOwner = anonUserId && page.owner.anon_id === anonUserId;

  if (!isOwner) {
    if (page.is_hidden) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (page.status !== "live") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (page.live_expires_at && page.live_expires_at <= new Date()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  return NextResponse.json({
    page: {
      id: page.id,
      owner_id: page.owner_id,
      title: page.title,
      anon_number: page.anon_number,
      status: page.status,
      live_started_at: page.live_started_at,
      live_expires_at: page.live_expires_at,
      snapshot_thumbnail: page.snapshot_thumbnail,
      constraints_version: page.constraints_version,
      total_visits: page.total_visits,
      total_clicks: page.total_clicks,
      avg_duration_ms: page.avg_duration_ms,
      bounce_rate: page.bounce_rate,
      created_at: page.created_at,
      updated_at: page.updated_at,
    },
    version: page.current_version
      ? {
          id: page.current_version.id,
          page_id: page.current_version.page_id,
          content_json: page.current_version.content_json,
          created_at: page.current_version.created_at,
        }
      : null,
    owner: isOwner ? { anon_id: page.owner.anon_id } : null,
  });
}
