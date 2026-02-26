import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: Request, context: { params: Promise<{ pageId: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { pageId } = await context.params;
  const now = new Date();

  const page = await prisma.page.update({
    where: { id: pageId },
    data: {
      status: "expired",
      forced_expired_at: now,
    },
  });

  return NextResponse.json({ ok: true, page });
}
