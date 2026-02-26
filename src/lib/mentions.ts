import { prisma } from "@/lib/db";

/** content에서 @멘션 패턴 추출. @ 뒤에 anon_id 또는 식별자 (영문/숫자/언더스코어, 8~32자) */
const MENTION_REG = /@([a-zA-Z0-9_-]{8,32})/g;

export function extractMentionIds(content: string): string[] {
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_REG.lastIndex = 0;
  while ((m = MENTION_REG.exec(content)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * 멘션된 대상에게 페이지 알림 생성.
 * refId = 메시지/댓글 id, type = chat_mention | comment_mention
 */
export async function createMentionNotifications(
  pageId: string,
  refId: string,
  type: "chat_mention" | "comment_mention",
  content: string,
  senderLabel: string
): Promise<void> {
  const ids = extractMentionIds(content);
  if (ids.length === 0) return;

  const title = type === "chat_mention" ? "채팅에서 멘션됨" : "댓글에서 멘션됨";
  const body = `${senderLabel}: ${content.slice(0, 100)}${content.length > 100 ? "…" : ""}`;

  for (const id of ids) {
    const user = await prisma.user.findUnique({
      where: { anon_id: id },
      select: { id: true },
    });
    await prisma.pageNotification.create({
      data: {
        page_id: pageId,
        recipient_user_id: user?.id ?? null,
        recipient_anon_id: id,
        type,
        ref_id: refId,
        title,
        body,
      },
    });
  }
}
