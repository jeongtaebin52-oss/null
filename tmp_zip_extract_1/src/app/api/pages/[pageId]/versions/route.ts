import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";

type Params = { pageId: string };

/** Version History (Step 30): 저장 포인트 목록 조회. */
export async function GET(_req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(_req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: anonUserId, is_deleted: false },
    select: { id: true },
  });

  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const versions = await prisma.pageVersion.findMany({
    where: { page_id: pageId },
    orderBy: { created_at: "desc" },
    select: { id: true, created_at: true },
  });

  return NextResponse.json({
    ok: true,
    pageId,
    versions: versions.map((v) => ({ id: v.id, created_at: v.created_at.toISOString() })),
  });
}
