import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";
import { expireStalePages } from "@/lib/expire";

const MAX_EVENT_WINDOW_HOURS = 24;

type Params = { pageId: string };

export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return NextResponse.json({ error: "anon_user_id_required" }, { status: 401 });
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { pageId } = await context.params;

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id },
  });
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const features = resolvePlanFeatures(user.plan);
  if (!features.replayEnabled) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 402 });
  }

  const since = new Date(Date.now() - MAX_EVENT_WINDOW_HOURS * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { page_id: pageId, ts: { gte: since } },
    orderBy: { ts: "asc" },
  });

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      ts: event.ts,
      type: event.type,
      x: event.x,
      y: event.y,
      element_id: event.element_id,
      element_type: event.element_type,
      payload: event.payload,
    })),
  });
}
