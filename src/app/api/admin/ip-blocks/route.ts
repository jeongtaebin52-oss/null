import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { hashIp } from "@/lib/request";
import { logAdminAudit } from "@/lib/admin-audit";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

export async function GET(req: Request) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff", "viewer"] });
  if (!gate.ok) return gate.response;

  const take = Math.min(Number(new URL(req.url).searchParams.get("take") ?? "50") || 50, 200);
  const blocks = await prisma.ipBlock.findMany({ orderBy: { created_at: "desc" }, take });
  return NextResponse.json({ ok: true, blocks });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req, { roles: ["owner", "staff"] });
  if (!gate.ok) return gate.response;

  const parsed = await parseJsonBody(
    req,
    z
      .object({
        ip: z.string().optional(),
        reason: z.string().optional(),
      })
      .passthrough()
  );
  if (parsed.error) return parsed.error;

  const ipRaw = typeof parsed.data.ip === "string" ? parsed.data.ip.trim() : "";
  if (!ipRaw) return apiErrorJson("bad_request", 400);

  const ipHash = hashIp(ipRaw);
  const reason = typeof parsed.data.reason === "string" ? parsed.data.reason.trim().slice(0, 500) : null;

  // 정책확정: 신규 IP 차단 시 기본 30일 만료. null = 영구 차단(수동 설정 시).
  const DEFAULT_IP_BLOCK_DAYS = 30;
  const defaultExpiresAt = new Date(Date.now() + DEFAULT_IP_BLOCK_DAYS * 24 * 60 * 60 * 1000);

  const block = await prisma.ipBlock.upsert({
    where: { ip_hash: ipHash },
    update: {
      reason: reason ?? "manual",
      expires_at: defaultExpiresAt,
    },
    create: {
      ip_hash: ipHash,
      reason: reason ?? "manual",
      expires_at: defaultExpiresAt,
    },
  });

  await logAdminAudit({
    adminId: gate.admin.id,
    action: "ip_block_upsert",
    targetType: "ip_hash",
    targetId: ipHash,
    req,
    meta: { reason: reason ?? "manual" },
  });

  return NextResponse.json({ ok: true, block });
}
