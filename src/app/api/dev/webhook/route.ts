import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const payload = await req.text().catch(() => "");
  return NextResponse.json({ ok: true, received: payload.length });
}
