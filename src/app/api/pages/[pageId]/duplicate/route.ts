import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { createDraftPage } from "@/lib/pages";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/**
 * POST /api/pages/[pageId]/duplicate
 * 복제: 현재 사용자 소유 페이지를 초안으로 복제. 목록 갱신 후 에디터로 이동할 때 사용.
 */
export async function POST(
  req: Request,
  context: { params: Promise<Params> }
) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return apiErrorJson("anon_user_id_required", 401, "anon_id가 필요합니다.");
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return apiErrorJson("user_not_found", 404);
  }

  const { pageId } = await context.params;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: { current_version: true, owner: true },
  });

  if (!page || page.is_deleted) {
    return apiErrorJson("not_found", 404);
  }

  if (page.owner_id !== user.id) {
    return apiErrorJson("forbidden", 403);
  }

  const content =
    page.current_version?.content_json ?? null;
  if (!content || typeof content !== "object") {
    return apiErrorJson("no_content_to_duplicate", 400);
  }

  const baseTitle = page.title?.trim() || `익명 작품 #${page.anon_number}`;
  const newTitle = `${baseTitle} 복제`;

  const { page: newPage } = await createDraftPage({
    ownerId: user.id,
    title: newTitle,
    contentJson: content,
  });

  return NextResponse.json({
    ok: true,
    pageId: newPage.id,
    id: newPage.id,
  });
}
