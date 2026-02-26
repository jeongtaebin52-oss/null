import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { substituteAlertTemplate } from "@/lib/alert-template";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string };

const COOLDOWN_MS = 5 * 60 * 1000;
const lastSent = new Map<string, number>();

/**
 * §31.8 알림 발송: 급감 등 사유로 Discord 메시지 전송. 쿨다운 5분.
 */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();

  const rl = await checkRateLimit(req, 5, 60_000);
  if (!rl.allowed) {
    return apiErrorJson("rate_limit", 429, "알림 전송은 분당 5회까지 가능합니다.");
  }

  const { pageId } = await context.params;
  const parsed = await parseJsonBody(
    req,
    z
      .object({
        type: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        clicks: z.number().optional(),
        leaves: z.number().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const cooldownKey =
    body.type === "spike" ? `${pageId}_spike_${body.start ?? ""}_${body.end ?? ""}` : `${pageId}_${body.type ?? ""}`;
  const now = Date.now();
  if (lastSent.get(cooldownKey) != null && now - lastSent.get(cooldownKey)! < COOLDOWN_MS) {
    return apiErrorJson("cooldown", 429, "동일 알림은 5분 후에 다시 보낼 수 있습니다.");
  }

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
  const nowDate = new Date();
  const todayStart = new Date(nowDate);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (body.type === "drop_warning") {
    const [visitsToday, visitsYesterday] = await Promise.all([
      prisma.liveSession.count({
        where: { page_id: pageId, started_at: { gte: todayStart } },
      }),
      prisma.liveSession.count({
        where: {
          page_id: pageId,
          started_at: { gte: yesterdayStart, lt: todayStart },
        },
      }),
    ]);

    const description = substituteAlertTemplate(
      "작품 **{title}**\n\n오늘 방문 **{visits_today}**회, 어제 **{visits_yesterday}**회로 전일 대비 급감이 감지되었습니다.",
      { title, visits_today: visitsToday, visits_yesterday: visitsYesterday }
    );
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: null,
        embeds: [
          {
            title: "NULL · 방문 급감 알림",
            description,
            color: 0xff9800,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return apiErrorJson("webhook_failed", 502, {
        message: "Discord 전송 실패.",
        detail: text.slice(0, 200),
      });
    }
    lastSent.set(cooldownKey, now);
    return NextResponse.json({ ok: true, message: "알림이 전송되었습니다." });
  }

  if (body.type === "spike") {
    const start = typeof body.start === "string" ? body.start : "";
    const end = typeof body.end === "string" ? body.end : "";
    const clicks = typeof body.clicks === "number" ? body.clicks : 0;
    const leaves = typeof body.leaves === "number" ? body.leaves : 0;

    const description = substituteAlertTemplate(
      "작품 **{title}**\n\n**구간**: {start} ~ {end}\n클릭 **{clicks}**회, 이탈 **{leaves}**회",
      { title, start, end, clicks, leaves }
    );
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: null,
        embeds: [
          {
            title: "NULL · 이상 구간 알림",
            description,
            color: 0x9c27b0,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return apiErrorJson("webhook_failed", 502, {
        message: "Discord 전송 실패.",
        detail: text.slice(0, 200),
      });
    }
    lastSent.set(cooldownKey, now);
    return NextResponse.json({ ok: true, message: "알림이 전송되었습니다." });
  }

  return apiErrorJson("invalid_type", 400);
}
