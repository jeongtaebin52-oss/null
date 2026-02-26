import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";

type Params = { pageId: string };

/** Version History (Step 30): 지정 버전으로 복구(현재 버전 포인터만 변경). */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });

  const payload = await req.json().catch(() => null);
  const versionId = typeof payload?.versionId === "string" ? payload.versionId : null;
  if (!versionId) return NextResponse.json({ ok: false, error: "version_id_required" }, { status: 400 });

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const version = await prisma.pageVersion.findFirst({
    where: { id: versionId, page_id: pageId },
    select: { id: true },
  });
  if (!version) return NextResponse.json({ ok: false, error: "version_not_found" }, { status: 404 });

  await prisma.page.update({
    where: { id: pageId },
    data: { current_version_id: versionId },
  });

  return NextResponse.json({ ok: true, pageId, versionId });
}
