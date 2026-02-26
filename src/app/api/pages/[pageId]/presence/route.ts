/**
 * K1: 코멘트·프레즌스 — 현재 페이지를 보고 있는 뷰어 수.
 * GET ?heartbeat=1 로 자신을 등록하고, 30초 미갱신 뷰어는 제외한 수를 반환.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";
import { getCollabInviteFromRequest, isCollabInviteValid } from "@/lib/collab";

const PRESENCE_TTL_MS = 30_000;

type PresenceEntry = { lastSeen: number };
const store = new Map<string, Map<string, PresenceEntry>>();

function getOrCreatePageMap(pageId: string): Map<string, PresenceEntry> {
  let m = store.get(pageId);
  if (!m) {
    m = new Map();
    store.set(pageId, m);
  }
  return m;
}

function prune(pageId: string): void {
  const m = store.get(pageId);
  if (!m) return;
  const now = Date.now();
  for (const [key, entry] of m.entries()) {
    if (now - entry.lastSeen > PRESENCE_TTL_MS) m.delete(key);
  }
}

export async function GET(req: Request, context: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true, owner_id: true, is_hidden: true, status: true, live_expires_at: true, collab_invite_code: true, collab_invite_enabled: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  const anonUserId = await resolveAnonUserId(req);
  const user = anonUserId ? await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } }) : null;
  const viewerId = user?.id ?? null;
  const collabInvite = getCollabInviteFromRequest(req);
  const allowInvite = isCollabInviteValid(collabInvite, {
    collab_invite_code: page.collab_invite_code ?? null,
    collab_invite_enabled: page.collab_invite_enabled ?? false,
  });
  const canView =
    allowInvite ||
    page.owner_id === viewerId ||
    (!page.is_hidden && page.status === "live" && (!page.live_expires_at || page.live_expires_at > new Date()));
  if (!canView) return apiErrorJson("not_found", 404);

  const viewerKey = anonUserId ?? `anon_${Math.random().toString(36).slice(2)}`;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("heartbeat") === "1") {
    const m = getOrCreatePageMap(pageId);
    m.set(viewerKey, { lastSeen: Date.now() });
  }

  prune(pageId);
  const m = store.get(pageId);
  const viewers = m ? m.size : 0;

  return NextResponse.json({ viewers });
}

