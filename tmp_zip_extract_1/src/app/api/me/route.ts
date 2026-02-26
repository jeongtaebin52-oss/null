import { NextResponse } from "next/server";
import { resolveAnonUserId, ensureAnonUser } from "@/lib/anon";
import { resolvePlanFeatures } from "@/lib/plan";

export async function GET(req: Request) {
  const anonUserId = await resolveAnonUserId(req);
  if (!anonUserId) {
    return NextResponse.json({ error: "anon_user_id_required" }, { status: 401 });
  }

  const user = await ensureAnonUser(anonUserId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
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
