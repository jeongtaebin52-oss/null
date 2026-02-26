import { describe, expect, it } from "vitest";
import {
  getDefaultPlanFeatures,
  resolvePlanFeatures,
  type PlanFeatures,
} from "../src/lib/plan";
import type { Plan, PlanTier } from "@prisma/client";

describe("plan", () => {
  describe("getDefaultPlanFeatures", () => {
    it("returns free tier defaults", () => {
      const f = getDefaultPlanFeatures("free");
      expect(f.maxLivePages).toBe(1);
      expect(f.maxButtons).toBe(3);
      expect(f.replayEnabled).toBe(false);
    });

    it("returns standard tier defaults", () => {
      const f = getDefaultPlanFeatures("standard");
      expect(f.maxLivePages).toBe(2);
      expect(f.maxElements).toBe(40);
      expect(f.detailedReports).toBe(true);
    });

    it("returns pro and enterprise tier defaults", () => {
      expect(getDefaultPlanFeatures("pro").maxLivePages).toBe(4);
      expect(getDefaultPlanFeatures("enterprise").maxLivePages).toBe(10);
    });
  });

  describe("resolvePlanFeatures", () => {
    it("returns free fallback when plan is null", () => {
      const f = resolvePlanFeatures(null);
      expect(f.maxLivePages).toBe(1);
      expect(f.maxButtons).toBe(3);
    });

    it("returns free fallback when plan is undefined", () => {
      const f = resolvePlanFeatures(undefined);
      expect(f.maxLivePages).toBe(1);
    });

    it("returns tier defaults when plan has no features object", () => {
      const plan = { id: "standard" as PlanTier, name: "Standard", features: null } as Plan;
      const f = resolvePlanFeatures(plan);
      expect(f.maxLivePages).toBe(2);
      expect(f.maxElements).toBe(40);
    });

    it("merges plan features over tier defaults", () => {
      const plan = {
        id: "free" as PlanTier,
        name: "Free",
        features: { maxLivePages: 5 } as Partial<PlanFeatures>,
      } as Plan;
      const f = resolvePlanFeatures(plan);
      expect(f.maxLivePages).toBe(5);
      expect(f.maxButtons).toBe(3); // unchanged from free default
    });
  });
});
