import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId } from "@/lib/anon";
import { getPageForAsset } from "@/lib/page-access";
import { apiErrorJson } from "@/lib/api-error";

type Params = { pageId: string };

const statusEnum = z.enum(["idle", "ringing", "in_call", "ended"]);
const patchBodySchema = z.object({
  status: statusEnum,
});

/** GET: 페이지 내 참가자별 통화 상태 목록 */
export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const anonUserId = await resolveAnonUserId(req);
  const user = anonUserId ? await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } }) : null;
  const page = await getPageForAsset(pageId, req, user?.id ?? null);
  if (!page) return apiErrorJson("not_found", 404);

  const states = await prisma.callState.findMany({
    where: { page_id: pageId },
    select: { participant_id: true, status: true, updated_at: true },
  });

  return NextResponse.json({
    states: states.map((s) => ({
      participantId: s.participant_id,
      status: s.status,
      updatedAt: s.updated_at.toISOString(),
    })),
  });
}

/** PATCH: 현재 사용자 통화 상태 업데이트 (upsert) */
export async function PATCH(req: Request, context: { params: Promise<Params> }) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) return apiErrorJson("anon_required", 401);

  const { pageId } = await context.params;
  if (!pageId) return apiErrorJson("bad_page_id", 400);

  const user = await prisma.user.findUnique({ where: { anon_id: anonUserId }, select: { id: true } });
  if (!user) return apiErrorJson("user_not_found", 404);

  const page = await getPageForAsset(pageId, req, user.id);
  if (!page) return apiErrorJson("not_found", 404);

  const raw = await req.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(raw);
  if (!parsed.success) return apiErrorJson("invalid_body", 400, "status는 idle | ringing | in_call | ended 중 하나여야 합니다.");

  const participantId = anonUserId; // anon_id로 통일 (방문자/로그인 동일 식별)

  const row = await prisma.callState.upsert({
    where: { page_id_participant_id: { page_id: pageId, participant_id: participantId } },
    create: { page_id: pageId, participant_id: participantId, status: parsed.data.status },
    update: { status: parsed.data.status },
  });

  return NextResponse.json({
    ok: true,
    participantId: row.participant_id,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  });
}
