import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { canPublishMore } from "@/lib/policy";
import { computeLiveExpiry, expireStalePages } from "@/lib/expire";
import { resolvePlanFeatures } from "@/lib/plan";

type Params = { pageId: string };

export async function POST(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });
  }

  const { pageId } = await context.params;
  if (!pageId) {
    return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
  });

  if (!page) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (!page.current_version_id) {
    return NextResponse.json({ ok: false, error: "no_version" }, { status: 400 });
  }

  const now = new Date();
  const features = resolvePlanFeatures(user.plan);

  const liveCount = await prisma.page.count({
    where: {
      owner_id: user.id,
      status: "live",
      id: { not: page.id },
      live_expires_at: { gt: now },
    },
  });

  if (!canPublishMore({ liveCount, maxLive: features.maxLivePages })) {
    // TODO(정책확정 필요): 기존 LIVE 만료 처리 vs 게시 거부 정책 확정
    await prisma.page.updateMany({
      where: { owner_id: user.id, status: "live", id: { not: page.id } },
      data: { status: "expired", live_expires_at: now },
    });
  }

  const updated = await prisma.page.update({
    where: { id: page.id },
    data: {
      status: "live",
      live_started_at: now,
      live_expires_at: computeLiveExpiry(now),
    },
  });

  return NextResponse.json({
    ok: true,
    pageId: updated.id,
    page: updated,
  });
}
