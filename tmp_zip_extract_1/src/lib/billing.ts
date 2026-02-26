import Stripe from "stripe";

export type BillingProvider = "mock" | "stripe";

export type UpgradeRequest = {
  targetPlan: "free" | "standard" | "pro" | "enterprise";
  userId: string;
  anonId: string;
  email?: string | null;
};

export type UpgradeResult = {
  ok: boolean;
  message?: string;
  redirectUrl?: string;
};

export interface BillingClient {
  upgrade(request: UpgradeRequest): Promise<UpgradeResult>;
}

class MockBillingClient implements BillingClient {
  constructor(private readonly shouldFail = false, private readonly message?: string) {}

  async upgrade() {
    if (this.shouldFail) return { ok: false, message: this.message ?? "billing_unavailable" };
    return { ok: true };
  }
}

function resolveStripePrice(plan: UpgradeRequest["targetPlan"]) {
  if (plan === "standard") return process.env.STRIPE_PRICE_STANDARD ?? null;
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "enterprise") return process.env.STRIPE_PRICE_ENTERPRISE ?? null;
  return null;
}

function resolveBaseUrl() {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

class StripeBillingClient implements BillingClient {
  private stripe: Stripe | null;
  private readonly baseUrl: string;

  constructor() {
    const secret = process.env.STRIPE_SECRET_KEY;
    this.baseUrl = resolveBaseUrl();
    this.stripe = secret ? new Stripe(secret) : null;
  }

  async upgrade(request: UpgradeRequest): Promise<UpgradeResult> {
    if (!this.stripe) {
      return { ok: false, message: "stripe_not_configured" };
    }
    const priceId = resolveStripePrice(request.targetPlan);
    if (!priceId) {
      return { ok: false, message: "stripe_price_missing" };
    }

    const successUrl =
      process.env.STRIPE_SUCCESS_URL ??
      `${this.baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL ?? `${this.baseUrl}/billing/cancel`;

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: request.userId,
      customer_email: request.email ?? undefined,
      metadata: {
        targetPlan: request.targetPlan,
        userId: request.userId,
        anonId: request.anonId,
      },
    });

    return { ok: true, redirectUrl: session.url ?? undefined };
  }
}

export function getBillingClient(provider: BillingProvider | undefined) {
  if (provider === "stripe") {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return new MockBillingClient(true, "stripe_not_configured");
    }
    return new StripeBillingClient();
  }
  return new MockBillingClient();
}
