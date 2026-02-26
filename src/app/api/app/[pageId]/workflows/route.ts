import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withErrorHandler, safeParseBody } from "@/lib/api-handler";
import { triggerWorkflowsForEvent } from "@/lib/app-workflow";

export const GET = withErrorHandler(
  async (_req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const workflows = await prisma.appWorkflow.findMany({
      where: { page_id: pageId },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json({ workflows });
  }
);

export const POST = withErrorHandler(
  async (req: Request, context: { params: Promise<{ pageId: string }> }) => {
    const { pageId } = await context.params;
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "body_required", message: "요청 본문이 필요합니다." }, { status: 400 });

    if (body.action === "trigger") {
      const triggerType = String(body.triggerType ?? "");
      const triggerMeta = (body.meta as Record<string, string>) ?? {};
      const triggerData = body.data;
      const results = await triggerWorkflowsForEvent(pageId, triggerType, triggerMeta, triggerData);
      return NextResponse.json({ ok: true, results });
    }

    const name = String(body.name ?? "");
    const trigger = body.trigger as object;
    const steps = body.steps as object[];
    if (!name || !trigger) {
      return NextResponse.json({ error: "name and trigger required", message: "name과 trigger가 필요합니다." }, { status: 400 });
    }

    const workflow = await prisma.appWorkflow.create({
      data: {
        page_id: pageId,
        name,
        trigger: trigger as object,
        steps: (steps ?? []) as object,
        enabled: body.enabled !== false,
      },
    });
    return NextResponse.json({ ok: true, workflow });
  }
);

export const PATCH = withErrorHandler(
  async (req: Request, _context: { params: Promise<{ pageId: string }> }) => {
    const body = (await safeParseBody(req)) as Record<string, unknown> | null;
    if (!body?.id) return NextResponse.json({ error: "id_required", message: "id가 필요합니다." }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.trigger !== undefined) data.trigger = body.trigger as object;
    if (body.steps !== undefined) data.steps = body.steps as object;
    if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);

    const workflow = await prisma.appWorkflow.update({
      where: { id: String(body.id) },
      data,
    });
    return NextResponse.json({ ok: true, workflow });
  }
);

export const DELETE = withErrorHandler(
  async (req: Request) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id_required", message: "id가 필요합니다." }, { status: 400 });
    await prisma.appWorkflow.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
