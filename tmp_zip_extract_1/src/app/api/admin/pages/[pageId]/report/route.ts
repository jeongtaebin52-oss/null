import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { getClientIp, hashIp } from "@/lib/request";

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
  if (!anonUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page || page.is_deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Public reporting is only for live & visible pages.
  if (page.status !== "live" || page.is_hidden) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (page.live_expires_at && page.live_expires_at <= new Date()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const reasonRaw = typeof (body as any)?.reason === "string" ? (body as any).reason : "";
  const reason = reasonRaw.trim().slice(0, 500) || null;

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
