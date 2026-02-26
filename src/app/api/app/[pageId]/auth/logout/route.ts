import { NextResponse } from "next/server";
import { logoutAppUser } from "@/lib/app-auth";
import { withErrorHandler } from "@/lib/api-handler";
import { cookies } from "next/headers";

export const POST = withErrorHandler(
  async (_req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const cookieStore = await cookies();
    const token = cookieStore.get(`app_token_${pageId}`)?.value;
    if (token) {
      await logoutAppUser(token);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(`app_token_${pageId}`, "", { maxAge: 0, path: "/" });
    return res;
  }
);
