import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getClientIp, hashIp } from "@/lib/request";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";
import { getSystemBoolean } from "@/lib/system-settings";

/**
 * Report a page.
 *
 * - No email/phone required.
 * - Do NOT store raw IP; only store hashed IP.
 * - Reason is optional and must be short; do not collect any other form input.
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

  // Public reporting is only for live & visible pages.
  if (page.status !== "live" || page.is_hidden) {
    return apiErrorJson("not_found", 404);
  }
  if (page.live_expires_at && page.live_expires_at <= new Date()) {
    return apiErrorJson("not_found", 404);
  }

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        reason: z.string().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;

  const reasonRaw = typeof parsed.data.reason === "string" ? parsed.data.reason : "";
  const reason = reasonRaw.trim().slice(0, 500) || null;

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

  const report = await prisma.report.create({
    data: {
      page_id: pageId,
      user_id: user.id,
      reason,
      abuses: {
        create: { ip_hash: ipHash },
      },
    },
  });

  // Lightweight counter
  await prisma.page.update({
    where: { id: pageId },
    data: { report_count: { increment: 1 } },
  });

  return NextResponse.json({ ok: true, report: { id: report.id } });
}
