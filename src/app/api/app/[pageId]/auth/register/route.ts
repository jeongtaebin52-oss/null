import { NextResponse } from "next/server";
import { registerAppUser } from "@/lib/app-auth";
import { triggerWorkflowsForEvent } from "@/lib/app-workflow";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";

export const POST = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "요청 본문이 필요합니다." }, { status: 400 });

    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const displayName = body.display_name ? String(body.display_name) : undefined;

    try {
      const result = await registerAppUser(pageId, email, password, displayName);
      const res = NextResponse.json({ ok: true, user: result.user, token: result.token });
      res.cookies.set(`app_token_${pageId}`, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      triggerWorkflowsForEvent(pageId, "user_registered", undefined, {
        user: result.user,
        email,
        display_name: displayName ?? null,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[workflow] user_registered failed: ${msg}`);
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "회원가입에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
);
