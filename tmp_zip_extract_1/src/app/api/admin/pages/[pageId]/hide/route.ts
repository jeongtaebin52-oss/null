import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: Request, context: { params: Promise<{ pageId: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { pageId } = await context.params;
  const now = new Date();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const reasonRaw = typeof (body as any)?.reason === "string" ? (body as any).reason : "";
  const reason = reasonRaw.trim().slice(0, 500) || "admin_hide";

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      is_hidden: true,
      hidden_at: now,
      hidden_reason: reason,
    },
  });

  return NextResponse.json({ ok: true, page });
}
