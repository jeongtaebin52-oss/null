import { NextResponse } from "next/server";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";

async function requireOwner(pageId: string, req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return { page: null as null, error: apiErrorJson("anon_required", 401) };
  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return { page: null as null, error: apiErrorJson("user_not_found", 404) };
  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return { page: null as null, error: apiErrorJson("not_found", 404) };
  return { page, error: null };
}

export const GET = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const { error } = await requireOwner(pageId, req);
    if (error) return error;
    const secrets = await prisma.appSecret.findMany({
      where: { page_id: pageId },
      select: { id: true, key: true, created_at: true, updated_at: true },
      orderBy: { key: "asc" },
    });
    return NextResponse.json({ secrets });
  }
);

export const POST = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const { error } = await requireOwner(pageId, req);
    if (error) return error;
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body || !body.key || !body.value) {
      return NextResponse.json({ error: "key, value 필드가 필요합니다." }, { status: 400 });
    }

    const key = String(body.key).trim().toUpperCase();
    const value = String(body.value);

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      return NextResponse.json(
        { error: "키는 영문 대문자, 숫자, 밑줄만 사용 가능합니다." },
        { status: 400 }
      );
    }

    const secret = await prisma.appSecret.upsert({
      where: { page_id_key: { page_id: pageId, key } },
      create: { page_id: pageId, key, value },
      update: { value },
    });

    return NextResponse.json({
      ok: true,
      secret: { id: secret.id, key: secret.key, created_at: secret.created_at },
    });
  }
);

export const DELETE = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const { error } = await requireOwner(pageId, req);
    if (error) return error;
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key 파라미터가 필요합니다." }, { status: 400 });

    await prisma.appSecret.deleteMany({
      where: { page_id: pageId, key },
    });
    return NextResponse.json({ ok: true });
  }
);
