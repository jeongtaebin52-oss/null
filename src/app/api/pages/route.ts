import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { expireStalePages } from "@/lib/expire";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

function pickSmallestMissingPositive(nums: number[]) {
  const used = new Set<number>();
  for (const n of nums) {
    if (Number.isFinite(n) && n > 0) used.add(n);
  }
  let k = 1;
  while (used.has(k)) k++;
  return k;
}

export async function POST(req: Request) {
  await expireStalePages();

  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_user_id_required", 401);

  const user = await ensureAnonUser(anonUserId);
  if (!user) return apiErrorJson("user_not_found", 404);

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        title: z.string().optional(),
        content: z.unknown().optional(),
        content_json: z.unknown().optional(),
        doc: z.unknown().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;
  const payload = parsed.data;
  const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : null;

  // editor payloads can vary; accept both keys
  const content = payload.content ?? payload.content_json ?? payload.doc ?? null;

  if (!content || typeof content !== "object") {
    return apiErrorJson("content_required", 400);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const rows = await tx.page.findMany({
          where: { is_deleted: false },
          select: { anon_number: true },
        });

        const anonNumber = pickSmallestMissingPositive(
          rows.map((r) => r.anon_number).filter((v): v is number => typeof v === "number")
        );

        // 1) create page (draft)
        const page = await tx.page.create({
          data: {
            owner_id: user.id,
            title,
            status: "draft",
            constraints_version: "v1",
            anon_number: anonNumber,
          },
        });

        // 2) create first version
        const version = await tx.pageVersion.create({
          data: {
            page_id: page.id,
            content_json: content,
          },
        });

        // 3) set current_version_id
        const updatedPage = await tx.page.update({
          where: { id: page.id },
          data: { current_version_id: version.id },
        });

        return { page: updatedPage, version };
      });

      // ✅ Backwards/forwards compatible response
      return NextResponse.json({
        ok: true,
        pageId: created.page.id,
        id: created.page.id,
        page: created.page,
        version: created.version,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e ?? "");
      const isUnique = msg.includes("Unique constraint") || msg.includes("unique") || msg.includes("P2002");
      if (isUnique && attempt < 2) continue;
      throw e;
    }
  }

  return apiErrorJson("failed_to_create", 500);
}
