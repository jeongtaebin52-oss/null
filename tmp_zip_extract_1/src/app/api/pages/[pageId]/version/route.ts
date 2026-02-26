import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";

type Params = { pageId: string };

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const payload = await req.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.slice(0, 80) : null;

  const content =
    payload?.content ??
    payload?.content_json ??
    payload?.doc ??
    null;

  if (!content || typeof content !== "object") {
    return NextResponse.json({ ok: false, error: "content_required" }, { status: 400 });
  }

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });

  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

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
