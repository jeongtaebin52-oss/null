import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

type Params = { pageId: string };

/** §31.8 Discord 알림 테스트 전송. POST → webhook으로 테스트 메시지 전송 (owner only). */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const rl = await checkRateLimit(req, 5, 60_000);
  if (!rl.allowed) {
    return apiErrorJson("rate_limit", 429, "테스트 전송은 분당 5회까지 가능합니다.");
  }

  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const webhookRows = await prisma.$queryRaw<[{ discord_webhook_url: string | null }]>`
    SELECT "discord_webhook_url" FROM "Page" WHERE "id" = ${pageId} AND "is_deleted" = false
  `;
  const webhookUrl = webhookRows[0]?.discord_webhook_url?.trim();
  if (!webhookUrl) {
    return apiErrorJson("no_webhook", 400, "Discord 웹훅 URL을 먼저 설정해 주세요.");
  }

  const title = page.title || `익명 작품 #${page.anon_number}`;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: null,
      embeds: [
        {
          title: "NULL 알림 테스트",
          description: `작품 **${title}** 에서 보낸 테스트 메시지입니다.\n알림 연동이 정상적으로 설정되었습니다.`,
          color: 0x5865f2,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return apiErrorJson("webhook_failed", 502, {
      message: "Discord 전송 실패. URL을 확인해 주세요.",
      detail: text.slice(0, 200),
    });
  }
  return NextResponse.json({ ok: true, message: "테스트 메시지가 전송되었습니다." });
}
