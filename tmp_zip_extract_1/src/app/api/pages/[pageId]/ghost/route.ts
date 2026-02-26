import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getGhostTraces } from "@/lib/ghost";

type Params = { pageId: string };

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { owner: true },
  });

  if (!page || page.is_deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const anonUserId = await resolveAnonUserId(req);
  const isOwner = anonUserId && page.owner.anon_id === anonUserId;

  if (!isOwner) {
    if (page.status !== "live") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (page.live_expires_at && page.live_expires_at <= new Date()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  }

  const traces = await getGhostTraces(pageId);
  return NextResponse.json({ traces });
}
