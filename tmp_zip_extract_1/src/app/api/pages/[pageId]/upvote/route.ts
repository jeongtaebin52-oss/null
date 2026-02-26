import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getClientIp, hashIp } from "@/lib/request";

type Params = { pageId: string };

/**
 * Upvote a page.
 *
 * Anti-abuse (v1):
 * - Uses hashed IP to block multiple upvotes from the same IP.
 * - No email/phone required.
 */

export async function POST(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.is_deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (page.status !== "live" || page.is_hidden) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (page.live_expires_at && page.live_expires_at <= new Date()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip ?? `noip:${anonUserId}`);
  // TODO(정책확정 필요): noip fallback을 허용할지 정책 결정.

  const blocked = await prisma.ipBlock.findFirst({
    where: {
      ip_hash: ipHash,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (blocked) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    await prisma.upvote.create({
      data: {
        page_id: pageId,
        user_id: user.id,
        ip_hash: ipHash,
      },
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
