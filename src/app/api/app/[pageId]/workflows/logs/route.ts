import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

async function requireOwner(pageId: string, req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return { userId: null as null, error: apiErrorJson("anon_required", 401) };
  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return { userId: null as null, error: apiErrorJson("user_not_found", 404) };
  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return { userId: null as null, error: apiErrorJson("not_found", 404) };
  return { userId: user.id, error: null };
}

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);
  const { error } = await requireOwner(pageId, req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  const limitRaw = searchParams.get("limit");
  const cursorRaw = searchParams.get("cursor");

  const limit = z.number().int().min(1).max(200).catch(50).parse(limitRaw ? Number(limitRaw) : undefined);
  const cursor = cursorRaw ? new Date(cursorRaw) : null;

  const logs = await prisma.appWorkflowLog.findMany({
    where: {
      page_id: pageId,
      ...(workflowId ? { workflow_id: workflowId } : {}),
      ...(cursor ? { started_at: { lt: cursor } } : {}),
    },
    orderBy: { started_at: "desc" },
    take: limit,
    select: {
      id: true,
      workflow_id: true,
      status: true,
      input: true,
      output: true,
      error: true,
      started_at: true,
      finished_at: true,
    },
  });

  const nextCursor = logs.length ? logs[logs.length - 1].started_at.toISOString() : null;
  return NextResponse.json({ logs, nextCursor });
}
