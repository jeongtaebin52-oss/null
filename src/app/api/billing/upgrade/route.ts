import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { getBillingClient } from "@/lib/billing";
import { ensurePlanDefaults } from "@/lib/plan";
import { logApiError } from "@/lib/logger";
import { apiErrorJson } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const anonUserId = await resolveAnonUserId(req);
    if (!anonUserId) {
      return apiErrorJson("anon_user_id_required", 401);
    }

    await ensurePlanDefaults(prisma);
    const user = await ensureAnonUser(anonUserId);
    if (!user) {
      return apiErrorJson("user_not_found", 404);
    }

    const parsed = await parseJsonBody(
      req,
      z
        .object({
          targetPlan: z.string().optional(),
          target_plan: z.string().optional(),
        })
        .passthrough()
    );
    if (parsed.error) return parsed.error;
    const payload = parsed.data;

    const url = new URL(req.url);
    const targetCandidate =
      payload.targetPlan ??
      payload.target_plan ??
      url.searchParams.get("targetPlan") ??
      url.searchParams.get("target_plan");
    const targetPlan =
      targetCandidate === "standard" || targetCandidate === "pro" || targetCandidate === "enterprise"
        ? targetCandidate
        : "free";

    if (targetPlan === "free") {
      return apiErrorJson("invalid_plan", 400);
    }

    const billing = getBillingClient(process.env.BILLING_PROVIDER as "mock" | "stripe" | undefined);
    const result = await billing.upgrade({
      targetPlan,
      userId: user.id,
      anonId: user.anon_id,
      email: user.email,
    });

    if (!result.ok) {
      return apiErrorJson(result.message ?? "upgrade_failed", 400);
    }

    if ("redirectUrl" in result && result.redirectUrl) {
      return NextResponse.json({
        ok: true,
        redirectUrl: result.redirectUrl,
        provider: "stripe",
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { plan_id: targetPlan },
    });

    return NextResponse.json({
      ok: true,
      plan: updated.plan_id,
    });
  } catch (error) {
    logApiError(req, "billing upgrade failed", error);
    return apiErrorJson("upgrade_failed", 500);
  }
}
