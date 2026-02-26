import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { getPageForAsset } from "@/lib/page-access";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

type SearchType = "all" | "comments" | "chat" | "todos" | "notes" | "calendar";

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const anonUserId = await resolveAnonUserId(req);
  const user = anonUserId ? await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } }) : null;
  const page = await getPageForAsset(pageId, req, user?.id ?? null);
  if (!page) return apiErrorJson("not_found", 404);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const typeRaw = (searchParams.get("type") ?? "all").toLowerCase();
  const type: SearchType =
    typeRaw === "comments" || typeRaw === "chat" || typeRaw === "todos" || typeRaw === "notes" || typeRaw === "calendar"
      ? typeRaw
      : "all";

  if (!q || q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const results: Array<{
    type: string;
    id: string;
    snippet: string;
    createdAt: string;
    meta?: Record<string, unknown>;
  }> = [];

  if (type === "all" || type === "comments") {
    const comments = await prisma.comment.findMany({
      where: { page_id: pageId, content: { contains: q, mode: "insensitive" } },
      take: 20,
      orderBy: { created_at: "desc" },
      select: { id: true, content: true, created_at: true, node_id: true },
    });
    for (const c of comments) {
      results.push({
        type: "comment",
        id: c.id,
        snippet: c.content.slice(0, 200),
        createdAt: c.created_at.toISOString(),
        meta: c.node_id ? { nodeId: c.node_id } : undefined,
      });
    }
  }

  if (type === "all" || type === "chat") {
    const messages = await prisma.chatMessage.findMany({
      where: { page_id: pageId, content: { contains: q, mode: "insensitive" } },
      take: 20,
      orderBy: { created_at: "desc" },
      select: { id: true, content: true, created_at: true },
    });
    for (const m of messages) {
      results.push({
        type: "chat",
        id: m.id,
        snippet: m.content.slice(0, 200),
        createdAt: m.created_at.toISOString(),
      });
    }
  }

  if (type === "all" || type === "todos") {
    const todos = await prisma.todo.findMany({
      where: { page_id: pageId, title: { contains: q, mode: "insensitive" } },
      take: 20,
      orderBy: { updated_at: "desc" },
      select: { id: true, title: true, done: true, created_at: true },
    });
    for (const t of todos) {
      results.push({
        type: "todo",
        id: t.id,
        snippet: t.title,
        createdAt: t.created_at.toISOString(),
        meta: { done: t.done },
      });
    }
  }

  if (type === "all" || type === "notes") {
    const note = await prisma.note.findUnique({
      where: { page_id: pageId },
      select: { id: true, content: true, updated_at: true },
    });
    if (note && note.content.toLowerCase().includes(q.toLowerCase())) {
      const idx = note.content.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 50);
      const snippet = note.content.slice(start, start + 200);
      results.push({
        type: "note",
        id: note.id,
        snippet,
        createdAt: note.updated_at.toISOString(),
      });
    }
  }

  if (type === "all" || type === "calendar") {
    const events = await prisma.calendarEvent.findMany({
      where: { page_id: pageId, title: { contains: q, mode: "insensitive" } },
      take: 20,
      orderBy: { start_at: "desc" },
      select: { id: true, title: true, start_at: true },
    });
    for (const e of events) {
      results.push({
        type: "calendar",
        id: e.id,
        snippet: e.title,
        createdAt: e.start_at.toISOString(),
        meta: { startAt: e.start_at.toISOString() },
      });
    }
  }

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const limited = results.slice(0, 50);

  return NextResponse.json({ results: limited });
}
