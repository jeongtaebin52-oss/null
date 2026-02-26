import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string };

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        title: z.string().optional(),
        content: z.unknown().optional(),
        content_json: z.unknown().optional(),
        doc: z.unknown().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const payload = parsed.data;
  const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : null;

  const content = payload.content ?? payload.content_json ?? payload.doc ?? null;

  if (!content || typeof content !== "object") {
    return apiErrorJson("content_required", 400);
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });

  if (!page) return apiErrorJson("not_found", 404);

  const result = await prisma.$transaction(async (tx) => {
    const version = await tx.pageVersion.create({
      data: { page_id: pageId, content_json: content },
    });

    const updatedPage = await tx.page.update({
      where: { id: pageId },
      data: {
        current_version_id: version.id,
        ...(title !== null ? { title } : {}),
      },
    });

    return { version, page: updatedPage };
  });

  return NextResponse.json({ ok: true, pageId, page: result.page, version: result.version });
}
