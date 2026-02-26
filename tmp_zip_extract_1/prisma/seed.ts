import { PrismaClient, PlanTier } from "@prisma/client";

const prisma = new PrismaClient();

// TODO(정책확정 필요): plan limits and pricing.
const plans = [
  {
    id: PlanTier.free,
    name: "Free",
    price_cents: 0,
    features: {
      maxLivePages: 1,
      maxButtons: 3,
      maxTexts: 6,
      maxImages: 1,
      maxElements: 20,
      replayEnabled: false,
      detailedReports: false,
    },
  },
  {
    id: PlanTier.standard,
    name: "Standard",
    price_cents: 9900,
    features: {
      maxLivePages: 2,
      maxButtons: 6,
      maxTexts: 20,
      maxImages: 4,
      maxElements: 40,
      replayEnabled: true,
      detailedReports: true,
    },
  },
  {
    id: PlanTier.pro,
    name: "Pro",
    price_cents: 39000,
    features: {
      maxLivePages: 4,
      maxButtons: 10,
      maxTexts: 40,
      maxImages: 10,
      maxElements: 80,
      replayEnabled: true,
      detailedReports: true,
    },
  },
  {
    id: PlanTier.enterprise,
    name: "Enterprise",
    price_cents: null,
    features: {
      maxLivePages: 10,
      maxButtons: 20,
      maxTexts: 80,
      maxImages: 20,
      maxElements: 160,
      replayEnabled: true,
      detailedReports: true,
    },
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  await prisma.user.upsert({
    where: { anon_id: "anon_seed_1" },
    update: {},
    create: {
      anon_id: "anon_seed_1",
      plan_id: PlanTier.free,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
