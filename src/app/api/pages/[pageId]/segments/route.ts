import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string };

type SegmentRow = { id: string; page_id: string; name: string; conditions: unknown; created_at: Date; updated_at: Date };

/** §31.6 세그먼트 목록. GET → segments[] (raw SQL로 Segment 조회) */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const segments = await prisma.$queryRaw<SegmentRow[]>`
    SELECT id, page_id, name, conditions, created_at, updated_at
    FROM "Segment"
    WHERE page_id = ${pageId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({ segments });
}

/** 조건 형식: { op: "and"|"or", rules: [{ type: string, value: unknown, not?: boolean }] } */
export async function POST(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        name: z.string().optional(),
        conditions: z.unknown().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const body = parsed.data as {
    name?: string;
    conditions?: { op: "and" | "or"; rules: { type: string; value: unknown; not?: boolean }[] };
  };

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 128) : "";
  if (!name) return apiErrorJson("invalid_name", 400, "세그먼트 이름을 입력하세요.");

  const conditions = body.conditions;
  const op = conditions && typeof conditions === "object" ? (conditions as { op?: string }).op : undefined;
  if (!conditions || typeof conditions !== "object" || !(op === "and" || op === "or") || !Array.isArray((conditions as { rules?: unknown }).rules)) {
    return apiErrorJson("invalid_conditions", 400, "조건은 { op: 'and'|'or', rules: [...] } 형식이어야 합니다.");
  }

  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Segment" (id, page_id, name, conditions, "created_at", "updated_at") VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
    id,
    pageId,
    name,
    JSON.stringify(conditions),
    now,
    now
  );
  const [segment] = await prisma.$queryRaw<SegmentRow[]>`SELECT id, page_id, name, conditions, created_at, updated_at FROM "Segment" WHERE id = ${id}`;
  return NextResponse.json({
    ok: true,
    segment: segment ?? { id, page_id: pageId, name, conditions, created_at: now, updated_at: now },
  });
}
