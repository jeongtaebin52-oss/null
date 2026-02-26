import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { hashIp } from "@/lib/request";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const take = Math.min(Number(new URL(req.url).searchParams.get("take") ?? "50") || 50, 200);
  const blocks = await prisma.ipBlock.findMany({ orderBy: { created_at: "desc" }, take });
  return NextResponse.json({ ok: true, blocks });
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ipRaw = typeof (body as any)?.ip === "string" ? (body as any).ip.trim() : "";
  if (!ipRaw) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const ipHash = hashIp(ipRaw);
  const reason = typeof (body as any)?.reason === "string" ? (body as any).reason.trim().slice(0, 500) : null;

  const block = await prisma.ipBlock.upsert({
    where: { ip_hash: ipHash },
    update: {
      reason: reason ?? "manual",
      // TODO(정책확정 필요): 만료 정책.
      expires_at: null,
    },
    create: {
      ip_hash: ipHash,
      reason: reason ?? "manual",
      expires_at: null,
    },
  });

  return NextResponse.json({ ok: true, block });
}
