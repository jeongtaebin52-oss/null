import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { hashPassword, isValidPassword, normalizeEmail, verifyPassword } from "@/lib/auth";

const COOKIE_NAME = "anon_user_id";

export async function POST(req: Request) {
  try {
    let anonUserId = await resolveAnonUserId(req);
    if (!anonUserId) {
      anonUserId = `anon_${randomUUID()}`;
    }

    const payload = await req.json().catch(() => null);
  const email = normalizeEmail(String(payload?.email ?? ""));
  const password = String(payload?.password ?? "");
  const passwordConfirm = String(payload?.passwordConfirm ?? payload?.password_confirm ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "email_password_required" }, { status: 400 });
  }

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  if (passwordConfirm && passwordConfirm !== password) {
    return NextResponse.json({ error: "password_mismatch" }, { status: 400 });
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing && existing.id !== user.id) {
    if (existing.password_hash && verifyPassword(password, existing.password_hash)) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { last_login_at: new Date() },
      });
      const response = NextResponse.json({ ok: true, anonUserId: existing.anon_id, email: existing.email });
      response.cookies.set(COOKIE_NAME, existing.anon_id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }
    return NextResponse.json({ error: "email_in_use" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  if (user.email && user.email !== email) {
    const newAnonId = `anon_${randomUUID()}`;
    const created = await prisma.user.create({
      data: {
        anon_id: newAnonId,
        email,
        password_hash: passwordHash,
        last_login_at: new Date(),
      },
    });
    const response = NextResponse.json({
      ok: true,
      anonUserId: created.anon_id,
      email: created.email,
      switched: true,
    });
    response.cookies.set(COOKIE_NAME, created.anon_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      password_hash: passwordHash,
      last_login_at: new Date(),
    },
  });

  const response = NextResponse.json({
    ok: true,
    anonUserId: updated.anon_id,
    email: updated.email,
    nextPageId: payload?.nextPageId ?? null,
  });
  response.cookies.set(COOKIE_NAME, updated.anon_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
  } catch (error) {
    console.error("auth signup failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
