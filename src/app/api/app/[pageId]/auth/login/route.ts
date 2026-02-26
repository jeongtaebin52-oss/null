import { NextResponse } from "next/server";
import { loginAppUser } from "@/lib/app-auth";
import { triggerWorkflowsForEvent } from "@/lib/app-workflow";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";

export const POST = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "요청 본문이 필요합니다." }, { status: 400 });

    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    try {
      const result = await loginAppUser(pageId, email, password);
      const res = NextResponse.json({ ok: true, user: result.user, token: result.token });
      res.cookies.set(`app_token_${pageId}`, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      triggerWorkflowsForEvent(pageId, "user_logged_in", undefined, {
        user: result.user,
        email,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[workflow] user_logged_in failed: ${msg}`);
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "로그인에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 401 });
    }
  }
);
