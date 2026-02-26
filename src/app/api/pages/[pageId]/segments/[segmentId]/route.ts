import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

type Params = { pageId: string; segmentId: string };

/** §31.6 세그먼트 삭제. DELETE (raw SQL) */
export async function DELETE(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId, segmentId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Segment" WHERE id = ${segmentId} AND page_id = ${pageId}`;
  if (!existing.length) return apiErrorJson("not_found", 404);

  await prisma.$executeRawUnsafe(`DELETE FROM "Segment" WHERE id = $1`, segmentId);
  return NextResponse.json({ ok: true });
}

/** §31.6 세그먼트 수정. PATCH name, conditions */
export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  await expireStalePages();
  const { pageId, segmentId } = await context.params;
  const page = await prisma.page.findUnique({
    where: { id: pageId, is_deleted: false },
    include: { owner: true },
  });
  if (!page) return apiErrorJson("not_found", 404);
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId || page.owner.anon_id !== anonUserId) return apiErrorJson("forbidden", 403);

  const existing = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Segment" WHERE id = ${segmentId} AND page_id = ${pageId}`;
  if (!existing.length) return apiErrorJson("not_found", 404);

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

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (typeof body.name === "string") {
    updates.push(`name = $${idx++}`);
    values.push(body.name.trim().slice(0, 128));
  }
  const op = body.conditions && typeof body.conditions === "object" ? (body.conditions as { op?: string }).op : undefined;
  if (body.conditions && typeof body.conditions === "object" && (op === "and" || op === "or") && Array.isArray((body.conditions as { rules?: unknown }).rules)) {
    updates.push(`conditions = $${idx++}::jsonb`);
    values.push(JSON.stringify(body.conditions));
  }
  if (updates.length === 0) {
    const [row] = await prisma.$queryRaw<{ id: string; page_id: string; name: string; conditions: unknown; created_at: Date; updated_at: Date }[]>`
      SELECT id, page_id, name, conditions, created_at, updated_at FROM "Segment" WHERE id = ${segmentId}
    `;
    return NextResponse.json({ ok: true, segment: row });
  }
  updates.push(`"updated_at" = $${idx++}`);
  values.push(new Date());
  values.push(segmentId);
  await prisma.$executeRawUnsafe(`UPDATE "Segment" SET ${updates.join(", ")} WHERE id = $${idx + 1}`, ...values);
  const [updated] = await prisma.$queryRaw<{ id: string; page_id: string; name: string; conditions: unknown; created_at: Date; updated_at: Date }[]>`
    SELECT id, page_id, name, conditions, created_at, updated_at FROM "Segment" WHERE id = ${segmentId}
  `;
  return NextResponse.json({ ok: true, segment: updated });
}
