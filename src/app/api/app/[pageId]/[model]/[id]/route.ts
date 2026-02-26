import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { getCollectionBySlug, getRecord, updateRecord, deleteRecord, validateRecordData, type AppFieldDef } from "@/lib/app-data";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonObject } from "@/lib/validation";
import { triggerWorkflowsForEvent } from "@/lib/app-workflow";

type Params = { pageId: string; model: string; id: string };

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

/** GET: 단일 레코드 조회 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId, model, id } = await context.params;
  if (!pageId || !model || !id) return apiErrorJson("bad_request", 400);

  const { page, isOwner } = await getPageAndOwner(pageId, req);
  if (!page) return apiErrorJson("not_found", 404);
  if (!isOwner && (page.is_hidden || page.status !== "live")) return apiErrorJson("not_found", 404);

  const coll = await getCollectionBySlug(pageId, model);
  if (!coll) return apiErrorJson("collection_not_found", 404);

  const record = await getRecord(pageId, model, id);
  if (!record) return apiErrorJson("not_found", 404);

  return NextResponse.json({
    id: record.id,
    ...(record.data as object),
    created_at: record.created_at,
    updated_at: record.updated_at,
  });
}

/** PATCH: 레코드 수정 (소유자만) */
export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_required", 401);

  const { pageId, model, id } = await context.params;
  if (!pageId || !model || !id) return apiErrorJson("bad_request", 400);

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
  const existing = await getRecord(pageId, model, id);
  if (!existing) return apiErrorJson("not_found", 404);
  const merged = { ...(existing.data as Record<string, unknown>), ...(data as Record<string, unknown>) };
  const fields = (coll.fields ?? []) as AppFieldDef[];
  const strict = Boolean((coll as { strict?: boolean }).strict);
  const validated = validateRecordData(fields, merged, { mode: "update", strict });
  if (validated.errors.length) {
    return apiErrorJson("validation_failed", 400, { detail: validated.errors });
  }
  const record = await updateRecord(pageId, model, id, validated.data as Record<string, unknown>, { replace: true });
  if (!record) return apiErrorJson("not_found", 404);
  const changedFields = Object.keys(data as Record<string, unknown>);
  const triggerData = {
    id: record.id,
    pageId,
    page_id: pageId,
    collection: model,
    collection_slug: model,
    changed_fields: changedFields,
    ...(record.data as Record<string, unknown>),
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
  await triggerWorkflowsForEvent(
    pageId,
    "record_updated",
    { collection: model, field: changedFields.length === 1 ? changedFields[0] : "" },
    triggerData
  );

  return NextResponse.json({
    id: record.id,
    ...(record.data as object),
    created_at: record.created_at,
    updated_at: record.updated_at,
  });
}

/** DELETE: 레코드 삭제 (소유자만) */
export async function DELETE(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_required", 401);

  const { pageId, model, id } = await context.params;
  if (!pageId || !model || !id) return apiErrorJson("bad_request", 400);

  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await prisma.page.findFirst({
    where: { id: pageId, owner_id: user.id, is_deleted: false },
    select: { id: true },
  });
  if (!page) return apiErrorJson("not_found", 404);

  const coll = await getCollectionBySlug(pageId, model);
  if (!coll) return apiErrorJson("collection_not_found", 404);

  const record = await deleteRecord(pageId, model, id);
  if (!record) return apiErrorJson("not_found", 404);
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
  await triggerWorkflowsForEvent(pageId, "record_deleted", { collection: model }, triggerData);

  return NextResponse.json({ ok: true, id: record.id });
}
