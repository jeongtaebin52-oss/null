import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";

type Params = { pageId: string; commentId: string };

export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const { pageId, commentId } = await context.params;
  if (!pageId || !commentId) return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, page_id: pageId },
    include: { page: { select: { owner_id: true } } },
  });
  if (!comment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const canEdit = comment.user_id === user.id || comment.page.owner_id === user.id;
  if (!canEdit) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "body_required" }, { status: 400 });

  const updates: { content?: string; resolved?: boolean } = {};
  if (typeof body.content === "string") updates.content = body.content.trim().slice(0, 10000);
  if (typeof body.resolved === "boolean") updates.resolved = body.resolved;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: updates,
    include: { user: { select: { id: true, anon_id: true, email: true } } },
  });

  const author = updated.user.email ? updated.user.email : `Anonymous (${updated.user.anon_id.slice(0, 8)})`;
  return NextResponse.json({
    ok: true,
    comment: {
      id: updated.id,
      pageId: updated.page_id,
      nodeId: updated.node_id,
      userId: updated.user_id,
      author,
      x: updated.x,
      y: updated.y,
      content: updated.content,
      parentId: updated.parent_id,
      resolved: updated.resolved,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    },
  });
}

export async function DELETE(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const { pageId, commentId } = await context.params;
  if (!pageId || !commentId) return NextResponse.json({ ok: false, error: "bad_params" }, { status: 400 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, page_id: pageId },
    include: { page: { select: { owner_id: true } } },
  });
  if (!comment) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const canDelete = comment.user_id === user.id || comment.page.owner_id === user.id;
  if (!canDelete) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  await prisma.comment.deleteMany({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
