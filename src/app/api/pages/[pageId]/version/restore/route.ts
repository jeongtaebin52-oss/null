import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string };

/** Version History (Step 30): 지정 버전으로 복구(현재 버전 포인터만 변경). */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        versionId: z.string().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const versionId = typeof parsed.data.versionId === "string" ? parsed.data.versionId : null;
  if (!versionId) return apiErrorJson("version_id_required", 400);

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  const version = await prisma.pageVersion.findFirst({
    where: { id: versionId, page_id: pageId },
    select: { id: true },
  });
  if (!version) return apiErrorJson("version_not_found", 404);

  await prisma.page.update({
    where: { id: pageId },
    data: { current_version_id: versionId },
  });

  return NextResponse.json({ ok: true, pageId, versionId });
}
