import type { Plan, PlanTier, PrismaClient } from "@prisma/client";

export type PlanFeatures = {
  maxLivePages: number;
  maxButtons: number;
  maxTexts: number;
  maxImages: number;
  maxElements: number;
  replayEnabled: boolean;
  detailedReports: boolean;
  /** §6.3 플랜별 History 기간/개수: 내 라이브러리 과거 공개 노출 개수 */
  maxHistoryItems: number;
};

/** 기본 1개, 프로 5개. 엔터프라이즈 상한은 문서에 별도 기재하지 않음. */
const DEFAULT_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    maxLivePages: 1,
    maxButtons: 3,
    maxTexts: 6,
    maxImages: 1,
    maxElements: 20,
    replayEnabled: false,
    detailedReports: false,
    maxHistoryItems: 10,
  },
  standard: {
    maxLivePages: 1,
    maxButtons: 6,
    maxTexts: 20,
    maxImages: 4,
    maxElements: 40,
    replayEnabled: true,
    detailedReports: true,
    maxHistoryItems: 30,
  },
  pro: {
    maxLivePages: 5,
    maxButtons: 10,
    maxTexts: 40,
    maxImages: 10,
    maxElements: 80,
    replayEnabled: true,
    detailedReports: true,
    maxHistoryItems: 50,
  },
  enterprise: {
    maxLivePages: 10,
    maxButtons: 20,
    maxTexts: 80,
    maxImages: 20,
    maxElements: 160,
    replayEnabled: true,
    detailedReports: true,
    maxHistoryItems: 100,
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
