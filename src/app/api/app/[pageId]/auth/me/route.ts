import { NextResponse } from "next/server";
import { getAppUserByToken, updateAppUserProfile, changeAppUserPassword } from "@/lib/app-auth";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";
import { cookies } from "next/headers";

async function getToken(pageId: string, req: Request): Promise<string | undefined> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const cookieStore = await cookies();
  return cookieStore.get(`app_token_${pageId}`)?.value;
}

export const GET = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const token = await getToken(pageId, req);
    if (!token) return NextResponse.json({ user: null });

    const user = await getAppUserByToken(token);
    return NextResponse.json({ user });
  }
);

export const PATCH = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const token = await getToken(pageId, req);
    if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const user = await getAppUserByToken(token);
    if (!user) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "요청 본문이 필요합니다." }, { status: 400 });

    const updated = await updateAppUserProfile(user.id, {
      display_name: body.display_name != null ? String(body.display_name) : undefined,
      avatar_url: body.avatar_url != null ? String(body.avatar_url) : undefined,
      metadata: body.metadata,
    });
    return NextResponse.json({ ok: true, user: updated });
  }
);

export const PUT = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const token = await getToken(pageId, req);
    if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const user = await getAppUserByToken(token);
    if (!user) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "요청 본문이 필요합니다." }, { status: 400 });

    try {
      await changeAppUserPassword(user.id, String(body.current_password ?? ""), String(body.new_password ?? ""));
      return NextResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "비밀번호 변경에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
);
