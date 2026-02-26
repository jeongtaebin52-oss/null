import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";
import { randomUUID } from "crypto";

type Params = { pageId: string };

function generateInviteCode() {
  return `inv_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true, collab_invite_code: true, collab_invite_enabled: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  return NextResponse.json({
    ok: true,
    enabled: page.collab_invite_enabled,
    code: page.collab_invite_enabled ? page.collab_invite_code : null,
  });
}

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        action: z.enum(["enable", "rotate", "disable"]).optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;

  const action = parsed.data.action ?? "enable";

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  if (action === "disable") {
    const updated = await prisma.page.update({
      where: { id: pageId },
      data: { collab_invite_enabled: false, collab_invite_code: null, collab_invite_updated_at: new Date() },
      select: { collab_invite_enabled: true, collab_invite_code: true },
    });
    return NextResponse.json({ ok: true, enabled: updated.collab_invite_enabled, code: updated.collab_invite_code });
  }

  const code = generateInviteCode();
  const updated = await prisma.page.update({
    where: { id: pageId },
    data: { collab_invite_enabled: true, collab_invite_code: code, collab_invite_updated_at: new Date() },
    select: { collab_invite_enabled: true, collab_invite_code: true },
  });

  return NextResponse.json({ ok: true, enabled: updated.collab_invite_enabled, code: updated.collab_invite_code });
}
