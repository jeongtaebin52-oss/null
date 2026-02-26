import type { Plan, PlanTier, PrismaClient } from "@prisma/client";

export type PlanFeatures = {
  maxLivePages: number;
  maxButtons: number;
  maxTexts: number;
  maxImages: number;
  maxElements: number;
  replayEnabled: boolean;
  detailedReports: boolean;
};

const DEFAULT_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    maxLivePages: 1,
    maxButtons: 3,
    maxTexts: 6,
    maxImages: 1,
    maxElements: 20,
    replayEnabled: false,
    detailedReports: false,
  },
  standard: {
    maxLivePages: 2,
    maxButtons: 6,
    maxTexts: 20,
    maxImages: 4,
    maxElements: 40,
    replayEnabled: true,
    detailedReports: true,
  },
  pro: {
    maxLivePages: 4,
    maxButtons: 10,
    maxTexts: 40,
    maxImages: 10,
    maxElements: 80,
    replayEnabled: true,
    detailedReports: true,
  },
  enterprise: {
    maxLivePages: 10,
    maxButtons: 20,
    maxTexts: 80,
    maxImages: 20,
    maxElements: 160,
    replayEnabled: true,
    detailedReports: true,
  },
};

const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  standard: "Standard",
  pro: "Pro",
  enterprise: "Enterprise",
};

let hasSeededPlans = false;

export async function ensurePlanDefaults(prisma: PrismaClient) {
  if (hasSeededPlans) return;
  const tiers = Object.keys(DEFAULT_FEATURES) as PlanTier[];
  try {
    await Promise.all(
      tiers.map((tier) =>
        prisma.plan.upsert({
          where: { id: tier },
          update: {
            name: PLAN_LABELS[tier],
            features: DEFAULT_FEATURES[tier],
          },
          create: {
            id: tier,
            name: PLAN_LABELS[tier],
            features: DEFAULT_FEATURES[tier],
          },
        }),
      ),
    );
    hasSeededPlans = true;
  } catch {
    // If seeding fails, let callers handle downstream errors.
  }
}

export function resolvePlanFeatures(plan: Plan | null | undefined) {
  const tier = plan?.id ?? "free";
  const fallback = DEFAULT_FEATURES[tier];

  if (!plan?.features || typeof plan.features !== "object") {
    return fallback;
  }

  const features = plan.features as Partial<PlanFeatures>;
  return { ...fallback, ...features };
}

export function getDefaultPlanFeatures(tier: PlanTier) {
  return DEFAULT_FEATURES[tier];
}
