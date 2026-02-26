import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string };

/** Prisma client가 discord_webhook_url 미포함이어도 동작하도록 raw SQL 사용 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { owner_id: true, owner: { select: { anon_id: true } } },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);
  const rows = await prisma.$queryRaw<[{ discord_webhook_url: string | null }]>`
    SELECT "discord_webhook_url" FROM "Page" WHERE "id" = ${pageId} AND "is_deleted" = false
  `;
  const discord_webhook_url = rows[0]?.discord_webhook_url ?? null;
  let scheduled_report_enabled = false;
  let auto_drop_alert = false;
  try {
    const raw = await prisma.$queryRaw<[{ scheduled_report_enabled: boolean | null; auto_drop_alert: boolean | null }]>`
      SELECT "scheduled_report_enabled", "auto_drop_alert" FROM "Page" WHERE "id" = ${pageId} AND "is_deleted" = false
    `;
    scheduled_report_enabled = raw[0]?.scheduled_report_enabled ?? false;
    auto_drop_alert = raw[0]?.auto_drop_alert ?? false;
  } catch {
    /* columns may not exist yet */
  }
  return NextResponse.json({ discord_webhook_url, scheduled_report_enabled, auto_drop_alert });
}

export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        discord_webhook_url: z.string().nullable().optional(),
        scheduled_report_enabled: z.boolean().optional(),
        auto_drop_alert: z.boolean().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const url = body.discord_webhook_url;
  const validPrefixes = ["https://discord.com/api/webhooks/", "https://discordapp.com/api/webhooks/"];
  if (process.env.NODE_ENV !== "production") {
    validPrefixes.push("http://localhost", "http://127.0.0.1");
  }
  let value: string | null = null;
  if (url === null || url === undefined) value = null;
  else if (typeof url === "string" && url.trim() === "") value = null;
  else if (typeof url === "string" && validPrefixes.some((p) => url.startsWith(p))) value = url.trim();
  else if (typeof url === "string" && url.trim() !== "") {
    return apiErrorJson(
      "invalid_webhook_url",
      400,
      "Discord 웹훅 URL은 discord.com 또는 discordapp.com 형식이어야 합니다."
    );
  }

  await prisma.$executeRaw`
    UPDATE "Page" SET "discord_webhook_url" = ${value}
    WHERE "id" = ${pageId} AND "is_deleted" = false
  `;
  if (typeof body.scheduled_report_enabled === "boolean") {
    try {
      await prisma.$executeRaw`
        UPDATE "Page" SET "scheduled_report_enabled" = ${body.scheduled_report_enabled}
        WHERE "id" = ${pageId} AND "is_deleted" = false
      `;
    } catch {
      /* column may not exist */
    }
  }
  if (typeof body.auto_drop_alert === "boolean") {
    try {
      await prisma.$executeRaw`
        UPDATE "Page" SET "auto_drop_alert" = ${body.auto_drop_alert}
        WHERE "id" = ${pageId} AND "is_deleted" = false
      `;
    } catch {
      /* column may not exist */
    }
  }
  const out: { ok: true; discord_webhook_url: string | null; scheduled_report_enabled?: boolean; auto_drop_alert?: boolean } = {
    ok: true,
    discord_webhook_url: value,
  };
  if (typeof body.scheduled_report_enabled === "boolean") out.scheduled_report_enabled = body.scheduled_report_enabled;
  if (typeof body.auto_drop_alert === "boolean") out.auto_drop_alert = body.auto_drop_alert;
  return NextResponse.json(out);
}
