import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { getPageForAsset } from "@/lib/page-access";
import { apiErrorJson } from "@/lib/api-error";
import { getSocketIO } from "@/server/socket";
import { createMentionNotifications } from "@/lib/mentions";

type Params = { pageId: string };

const postBodySchema = z.object({
  content: z.string().min(1).max(10000).trim().optional(),
  message: z.string().min(1).max(10000).trim().optional(),
  text: z.string().min(1).max(10000).trim().optional(),
}).refine((d) => !!(d.content ?? d.message ?? d.text), { message: "content/message/text 중 하나가 필요합니다." });

export const GET = withErrorHandler(async (req: Request, context: { params: Promise<Params> }) => {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const anonUserId = await resolveAnonUserId(req);
  const user = anonUserId ? await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } }) : null;
  const page = await getPageForAsset(pageId, req, user?.id ?? null);
  if (!page) return apiErrorJson("not_found", 404);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  if (since && (Number.isNaN(sinceDate!.getTime()) || sinceDate!.getTime() <= 0))
    return apiErrorJson("invalid_since", 400);

  const messages = await prisma.chatMessage.findMany({
    where: {
      page_id: pageId,
      ...(sinceDate ? { created_at: { gt: sinceDate } } : {}),
    },
    orderBy: { created_at: "asc" },
    take: limit,
  });

  const payload = messages.map((m) => ({
    id: m.id,
    pageId: m.page_id,
    senderUserId: m.sender_user_id,
    senderAnonId: m.sender_anon_id,
    content: m.content,
    createdAt: m.created_at.toISOString(),
  }));

  return NextResponse.json({ messages: payload });
});

export const POST = withErrorHandler(async (req: Request, context: { params: Promise<Params> }) => {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await getPageForAsset(pageId, req, user.id);
  if (!page) return apiErrorJson("not_found", 404);

  const raw = await req.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiErrorJson("invalid_body", 400, "content/message/text 중 하나가 필요합니다. (1~10000자)");
  }
  const content = (parsed.data.content ?? parsed.data.message ?? parsed.data.text ?? "").trim();
  if (!content) return apiErrorJson("invalid_body", 400, "content/message/text 중 하나가 필요합니다.");

  const message = await prisma.chatMessage.create({
    data: {
      page_id: pageId,
      sender_user_id: user.id,
      sender_anon_id: user.anon_id,
      content,
    },
  });

  const payload = {
    id: message.id,
    pageId: message.page_id,
    senderUserId: message.sender_user_id,
    senderAnonId: message.sender_anon_id,
    content: message.content,
    createdAt: message.created_at.toISOString(),
  };

  const senderLabel = user.anon_id ? `@${user.anon_id.slice(0, 8)}` : "익명";
  createMentionNotifications(
    pageId,
    message.id,
    "chat_mention",
    message.content,
    senderLabel
  ).catch(() => {});

  const io = getSocketIO();
  if (io) {
    io.to(`page:${pageId}`).emit("chat:message", payload);
  }

  return NextResponse.json({ ok: true, message: payload });
});
