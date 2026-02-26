import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail, verifyPassword } from "@/lib/auth";

const COOKIE_NAME = "anon_user_id";

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);
    const email = normalizeEmail(String(payload?.email ?? ""));
    const password = String(payload?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "email_password_required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    const response = NextResponse.json({ ok: true, anonUserId: user.anon_id, email: user.email, nextPageId: payload?.nextPageId ?? null });
    response.cookies.set(COOKIE_NAME, user.anon_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("auth login failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
