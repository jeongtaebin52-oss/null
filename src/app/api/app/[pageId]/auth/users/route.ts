import { NextResponse } from "next/server";
import { listAppUsers, setAppUserRole, deleteAppUser, getAppUserByToken } from "@/lib/app-auth";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";
import { cookies } from "next/headers";
import { resolveAnonUserId } from "@/lib/anon";
import { prisma } from "@/lib/db";

async function getToken(pageId: string, req: Request): Promise<string | undefined> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const cookieStore = await cookies();
  return cookieStore.get(`app_token_${pageId}`)?.value;
}

async function isOwner(pageId: string, req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return false;
  const page = await prisma.page.findFirst({
    where: { id: pageId, owner: { anon_id: anonUserId }, is_deleted: false },
    select: { id: true },
  });
  return Boolean(page);
}

async function requireAdminOrOwner(pageId: string, req: Request) {
  if (await isOwner(pageId, req)) return { ok: true };
  const token = await getToken(pageId, req);
  if (!token) return { ok: false };
  const user = await getAppUserByToken(token);
  if (!user || user.role !== "admin") return { ok: false };
  return { ok: true };
}

export const GET = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const gate = await requireAdminOrOwner(pageId, req);
    if (!gate.ok) return NextResponse.json({ error: "관리자 또는 소유자 권한이 필요합니다." }, { status: 403 });

    const url = new URL(req.url);
    const role = url.searchParams.get("role") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const users = await listAppUsers(pageId, { role, limit, offset });
    return NextResponse.json({ users });
  }
);

export const PATCH = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const gate = await requireAdminOrOwner(pageId, req);
    if (!gate.ok) return NextResponse.json({ error: "관리자 또는 소유자 권한이 필요합니다." }, { status: 403 });

    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body || !body.user_id || !body.role) {
      return NextResponse.json({ error: "user_id와 role이 필요합니다." }, { status: 400 });
    }

    const updated = await setAppUserRole(String(body.user_id), String(body.role));
    return NextResponse.json({ ok: true, user: updated });
  }
);

export const DELETE = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const gate = await requireAdminOrOwner(pageId, req);
    if (!gate.ok) return NextResponse.json({ error: "관리자 또는 소유자 권한이 필요합니다." }, { status: 403 });

    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "user_id가 필요합니다." }, { status: 400 });

    await deleteAppUser(userId);
    return NextResponse.json({ ok: true });
  }
);
