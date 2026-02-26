import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { getCollectionBySlug, listRecords, createRecord, validateRecordData, type AppFieldDef } from "@/lib/app-data";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonObject } from "@/lib/validation";
import { triggerWorkflowsForEvent } from "@/lib/app-workflow";

type Params = { pageId: string; model: string };

async function getPageAndOwner(pageId: string, req: Request) {
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    select: { id: true, owner: { select: { anon_id: true } }, status: true, is_hidden: true },
  });
  if (!page) return { page: null as null, isOwner: false };
  const anonUserId = await resolveAnonUserId(req);
  const isOwner = !!anonUserId && page.owner.anon_id === anonUserId;
  return { page, isOwner };
}

/** GET: 해당 모델(컬렉션) 레코드 목록 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId, model } = await context.params;
  if (!pageId || !model) return apiErrorJson("bad_request", 400);

  const { page, isOwner } = await getPageAndOwner(pageId, req);
  if (!page) return apiErrorJson("not_found", 404);
  if (!isOwner && (page.is_hidden || page.status !== "live")) return apiErrorJson("not_found", 404);

  const coll = await getCollectionBySlug(pageId, model);
  if (!coll) return apiErrorJson("collection_not_found", 404);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const orderBy = (url.searchParams.get("orderBy") === "updated_at" ? "updated_at" : "created_at") as
    | "created_at"
    | "updated_at";
  const orderDir = url.searchParams.get("orderDir") === "asc" ? "asc" : "desc";

  const result = await listRecords(pageId, model, { limit, offset, orderBy, orderDir });
  return NextResponse.json({
    items: result.items.map((r) => ({
      id: r.id,
      ...(r.data as object),
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

/** POST: 레코드 생성 (소유자만) */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_required", 401);

  const { pageId, model } = await context.params;
  if (!pageId || !model) return apiErrorJson("bad_request", 400);

  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  const coll = await getCollectionBySlug(pageId, model);
  if (!coll) return apiErrorJson("collection_not_found", 404);

  const parsed = await parseJsonObject(req);
  if (parsed.error) return parsed.error;
  const data = typeof parsed.data === "object" && parsed.data !== null ? parsed.data : {};
  const fields = (coll.fields ?? []) as AppFieldDef[];
  const strict = Boolean((coll as { strict?: boolean }).strict);
  const validated = validateRecordData(fields, data as Record<string, unknown>, { mode: "create", strict });
  if (validated.errors.length) {
    return apiErrorJson("validation_failed", 400, { detail: validated.errors });
  }
  const record = await createRecord(pageId, model, validated.data as Record<string, unknown>);
  const triggerData = {
    id: record.id,
    pageId,
    page_id: pageId,
    collection: model,
    collection_slug: model,
    ...(record.data as Record<string, unknown>),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
  await triggerWorkflowsForEvent(pageId, "record_created", { collection: model }, triggerData);
  return NextResponse.json({
    id: record.id,
    ...(record.data as object),
    created_at: record.created_at,
    updated_at: record.updated_at,
  });
}
