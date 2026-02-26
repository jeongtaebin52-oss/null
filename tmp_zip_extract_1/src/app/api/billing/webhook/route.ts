import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function resolveStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return new Stripe(secret);
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "stripe_webhook_secret_missing" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "stripe_signature_missing" }, { status: 400 });
  }

  const stripe = resolveStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "stripe_signature_invalid" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const targetPlan = session.metadata?.targetPlan;
    const userId = session.metadata?.userId ?? session.client_reference_id ?? null;

    if (userId && (targetPlan === "standard" || targetPlan === "pro" || targetPlan === "enterprise")) {
      await prisma.user.update({
        where: { id: userId },
        data: { plan_id: targetPlan },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
