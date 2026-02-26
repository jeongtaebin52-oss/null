import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getClientIp, hashIp } from "@/lib/request";
import { apiErrorJson } from "@/lib/api-error";
import { getSystemBoolean } from "@/lib/system-settings";

type Params = { pageId: string };

/**
 * Upvote routes:
 * - GET: check if the requester already upvoted.
 * - POST: create upvote (deduped by ip_hash).
 * - DELETE: remove upvote within a short window.
 */
async function authAndPage(pageId: string, req: Request) {
  await expireStalePages();
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return { error: apiErrorJson("unauthorized", 401, "익명 세션이 필요합니다.") as NextResponse } as const;
  }
  const user = await ensureAnonUser(anonUserId);
  if (!user) return { error: apiErrorJson("unauthorized", 401) as NextResponse } as const;
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.is_deleted) return { error: apiErrorJson("not_found", 404) as NextResponse } as const;
  if (page.status !== "live" || page.is_hidden || (page.live_expires_at && page.live_expires_at <= new Date())) {
    return { error: apiErrorJson("not_found", 404) as NextResponse } as const;
  }

  const ip = getClientIp(req);
  const allowNoIpFallback = await getSystemBoolean("allow_noip_fallback", true);
  if (!ip && !allowNoIpFallback) {
    return { error: apiErrorJson("ip_required", 400, "IP가 필요합니다.") as NextResponse } as const;
  }
  const ipHash = hashIp(ip ?? `noip:${anonUserId}`);

  const blocked = await prisma.ipBlock.findFirst({
    where: { ip_hash: ipHash, OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
    select: { id: true },
  });
  if (blocked) return { error: apiErrorJson("forbidden", 403, "차단되었습니다.") as NextResponse } as const;
  return { user, page, ipHash } as const;
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ upvoted: false });
  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ upvoted: false });
  const ip = getClientIp(req);
  const allowNoIpFallback = await getSystemBoolean("allow_noip_fallback", true);
  if (!ip && !allowNoIpFallback) return NextResponse.json({ upvoted: false });
  const ipHash = hashIp(ip ?? `noip:${anonUserId}`);
  const existing = await prisma.upvote.findUnique({
    where: { page_id_ip_hash: { page_id: pageId, ip_hash: ipHash } },
    select: { id: true },
  });
  return NextResponse.json({ upvoted: !!existing });
}

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const auth = await authAndPage((await context.params).pageId, req);
  if ("error" in auth) return auth.error;
  const { pageId } = await context.params;
  const { user, ipHash } = auth;

  try {
    await prisma.upvote.create({
      data: { page_id: pageId, user_id: user.id, ip_hash: ipHash },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicated: true });
  }

  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { upvote_count: { increment: 1 } },
    select: { upvote_count: true },
  });
  return NextResponse.json({ ok: true, upvote_count: updated.upvote_count });
}

export async function DELETE(req: Request, context: { params: Promise<Params> }) {
  const auth = await authAndPage((await context.params).pageId, req);
  if ("error" in auth) return auth.error;
  const { pageId } = await context.params;
  const { ipHash } = auth;

  const existing = await prisma.upvote.findUnique({
    where: { page_id_ip_hash: { page_id: pageId, ip_hash: ipHash } },
    select: { id: true, created_at: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: true, removed: false, upvote_count: auth.page.upvote_count });
  }

  const UPVOTE_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;
  if (Date.now() - existing.created_at.getTime() > UPVOTE_CHANGE_WINDOW_MS) {
    return NextResponse.json({ ok: true, removed: false, upvote_count: auth.page.upvote_count });
  }

  await prisma.upvote.delete({ where: { id: existing.id } });
  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { upvote_count: { decrement: 1 } },
    select: { upvote_count: true },
  });
  return NextResponse.json({ ok: true, removed: true, upvote_count: Math.max(0, updated.upvote_count) });
}
