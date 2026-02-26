import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";

type Params = { pageId: string };

function canViewPage(page: { owner_id: string; is_hidden: boolean; status: string; live_expires_at: Date | null }, viewerUserId: string | null) {
  if (page.owner_id === viewerUserId) return true;
  if (page.is_hidden) return false;
  if (page.status !== "live") return false;
  if (page.live_expires_at && page.live_expires_at <= new Date()) return false;
  return true;
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ error: "bad_page_id" }, { status: 400 });

  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true, owner_id: true, is_hidden: true, status: true, live_expires_at: true },
  });
  if (!page) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const anonUserId = await resolveAnonUserId(req);
  const user = anonUserId ? await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } }) : null;
  const viewerId = user?.id ?? null;
  if (!canViewPage(page, viewerId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId") ?? undefined;
  const resolved = searchParams.get("resolved");
  const resolvedFilter =
    resolved === "true" ? true : resolved === "false" ? false : undefined;

  const comments = await prisma.comment.findMany({
    where: {
      page_id: pageId,
      parent_id: null,
      ...(nodeId != null ? { node_id: nodeId } : {}),
      ...(resolvedFilter !== undefined ? { resolved: resolvedFilter } : {}),
    },
    include: {
      user: { select: { id: true, anon_id: true, email: true } },
      replies: {
        include: { user: { select: { id: true, anon_id: true, email: true } } },
        orderBy: { created_at: "asc" },
      },
    },
    orderBy: { created_at: "asc" },
  });

  const mapAuthor = (u: { email: string | null; anon_id: string }) => (u.email ? u.email : `Anonymous (${u.anon_id.slice(0, 8)})`);
  const toPayload = (c: (typeof comments)[0]) => ({
    id: c.id,
    pageId: c.page_id,
    nodeId: c.node_id,
    userId: c.user_id,
    author: mapAuthor(c.user),
    x: c.x,
    y: c.y,
    content: c.content,
    parentId: c.parent_id,
    resolved: c.resolved,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    replies: c.replies.map((r) => ({
      id: r.id,
      pageId: r.page_id,
      nodeId: r.node_id,
      userId: r.user_id,
      author: mapAuthor(r.user),
      x: r.x,
      y: r.y,
      content: r.content,
      parentId: r.parent_id,
      resolved: r.resolved,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });

  return NextResponse.json({ comments: comments.map(toPayload) });
}

export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return NextResponse.json({ ok: false, error: "anon_user_id_required" }, { status: 401 });

  const { pageId } = await context.params;
  if (!pageId) return NextResponse.json({ ok: false, error: "bad_page_id" }, { status: 400 });

  const user = await ensureAnonUser(anonUserId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true, owner_id: true, is_hidden: true, status: true, live_expires_at: true },
  });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!canViewPage(page, user.id)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "body_required" }, { status: 400 });

  const x = typeof body.x === "number" ? body.x : 0;
  const y = typeof body.y === "number" ? body.y : 0;
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 10000) : "";
  const nodeId = typeof body.nodeId === "string" ? body.nodeId : null;
  const parentId = typeof body.parentId === "string" ? body.parentId : null;

  if (!content) return NextResponse.json({ ok: false, error: "content_required" }, { status: 400 });

  if (parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentId, page_id: pageId },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ ok: false, error: "parent_not_found" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      page_id: pageId,
      node_id: nodeId,
      user_id: user.id,
      x,
      y,
      content,
      parent_id: parentId,
    },
    include: { user: { select: { id: true, anon_id: true, email: true } } },
  });

  const author = comment.user.email ? comment.user.email : `Anonymous (${comment.user.anon_id.slice(0, 8)})`;
  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      pageId: comment.page_id,
      nodeId: comment.node_id,
      userId: comment.user_id,
      author,
      x: comment.x,
      y: comment.y,
      content: comment.content,
      parentId: comment.parent_id,
      resolved: comment.resolved,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      replies: [],
    },
  });
}
