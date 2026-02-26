import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getClientIp, hashIp } from "@/lib/request";
import { apiErrorJson } from "@/lib/api-error";
import { getSystemBoolean } from "@/lib/system-settings";

/**
 * Upvote a page.
 *
 * Anti-abuse (v1):
 * - Uses hashed IP to block multiple upvotes from the same IP.
 * - No email/phone required.
 * - If IP is missing, fallback can be controlled by SystemSetting.
 */

export async function POST(req: Request, context: { params: Promise<{ pageId: string }> }) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("unauthorized", 401, "익명 세션이 필요합니다.");
  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("unauthorized", 401);

  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.is_deleted) return apiErrorJson("not_found", 404);

  // Public upvote only for live & visible pages.
  if (page.status !== "live" || page.is_hidden) {
    return apiErrorJson("not_found", 404);
  }
  if (page.live_expires_at && page.live_expires_at <= new Date()) {
    return apiErrorJson("not_found", 404);
  }

  const ip = getClientIp(req);
  const allowNoIpFallback = await getSystemBoolean("allow_noip_fallback", true);
  if (!ip && !allowNoIpFallback) {
    return apiErrorJson("ip_required", 400, "IP가 필요합니다.");
  }
  const ipHash = hashIp(ip ?? `noip:${anonUserId}`);

  const blocked = await prisma.ipBlock.findFirst({
    where: {
      ip_hash: ipHash,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (blocked) return apiErrorJson("forbidden", 403, "차단되었습니다.");

  try {
    await prisma.upvote.create({
      data: {
        page_id: pageId,
        user_id: user.id,
        ip_hash: ipHash,
      },
    });
  } catch {
    // Duplicate upvote (unique constraint on [page_id, ip_hash])
    return NextResponse.json({ ok: true, duplicated: true });
  }

  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { upvote_count: { increment: 1 } },
    select: { upvote_count: true },
  });

  return NextResponse.json({ ok: true, upvote_count: updated.upvote_count });
}
