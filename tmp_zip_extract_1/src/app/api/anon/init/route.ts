import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ensurePlanDefaults } from "@/lib/plan";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "anon_user_id";
const HEADER_NAME = "x-anon-user-id";
const ANON_INIT_MAX_PER_MINUTE = 20;

export async function POST(req: Request) {
  if (!checkRateLimit(req, ANON_INIT_MAX_PER_MINUTE)) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  try {
    await ensurePlanDefaults(prisma);
    const cookieStore = await cookies();
    const cookieId = cookieStore.get(COOKIE_NAME)?.value ?? null;
    const headerId = req.headers.get(HEADER_NAME);

    const anonUserId = cookieId ?? headerId ?? `anon_${randomUUID()}`;

    let user = await prisma.user.findUnique({ where: { anon_id: anonUserId } });
    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            anon_id: anonUserId,
          },
        });
      } catch {
        user = await prisma.user.findUnique({ where: { anon_id: anonUserId } });
      }
    }

    if (!user) {
      return NextResponse.json({ error: "anon_user_unavailable" }, { status: 503 });
    }

    const response = NextResponse.json({ anonUserId: user.anon_id });
    response.cookies.set(COOKIE_NAME, user.anon_id, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("anon init failed", error);
    return NextResponse.json({ error: "anon_init_failed" }, { status: 500 });
  }
}
