import { NextResponse } from "next/server";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";
import { apiErrorJson } from "@/lib/api-error";

export async function GET(req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return apiErrorJson("anon_user_id_required", 401);
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return apiErrorJson("user_not_found", 404);
  }

  const features = resolvePlanFeatures(user.plan);
  return NextResponse.json({
    anonUserId: user.anon_id,
    email: user.email,
    isLoggedIn: Boolean(user.email && user.password_hash),
    plan: {
      id: user.plan?.id ?? "free",
      name: user.plan?.name ?? "Free",
    },
    features,
  });
}
