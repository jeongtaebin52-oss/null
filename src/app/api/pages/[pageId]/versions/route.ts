import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

/** Version History (Step 30): 저장 포인트 목록 조회. */
export async function GET(_req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(_req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true, current_version_id: true },
  });

  if (!page) return apiErrorJson("not_found", 404);

  const versions = await prisma.pageVersion.findMany({
    where: { page_id: pageId },
    orderBy: { created_at: "desc" },
    select: { id: true, created_at: true },
  });

  return NextResponse.json({
    ok: true,
    pageId,
    current_version_id: page.current_version_id,
    versions: versions.map((v) => ({ id: v.id, created_at: v.created_at.toISOString() })),
  });
}
