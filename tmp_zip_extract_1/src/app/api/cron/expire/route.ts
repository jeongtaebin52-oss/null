import { NextResponse } from "next/server";
import { expireStalePages } from "@/lib/expire";

/**
 * Cron: 24h 만료 자동화.
 * Vercel Cron에서 주기 호출 시 CRON_SECRET으로 인증.
 * 로컬/다른 스케줄러에서도 Authorization: Bearer <CRON_SECRET> 으로 호출 가능.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const count = await expireStalePages(new Date());
    return NextResponse.json({ ok: true, expired: count });
  } catch (e) {
    console.error("cron expire failed", e);
    return NextResponse.json({ error: "expire_failed" }, { status: 500 });
  }
}
