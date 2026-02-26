import { describe, expect, it } from "vitest";
import { computeLiveExpiry } from "../src/lib/expire";

describe("expire", () => {
  describe("computeLiveExpiry", () => {
    it("returns now + default 24 hours when hours not given", () => {
      const now = new Date("2025-02-03T12:00:00Z");
      const result = computeLiveExpiry(now);
      expect(result.getTime()).toBe(now.getTime() + 24 * 60 * 60 * 1000);
    });

    it("returns now + given hours", () => {
      const now = new Date("2025-02-03T00:00:00Z");
      const result = computeLiveExpiry(now, 48);
      expect(result.getTime()).toBe(now.getTime() + 48 * 60 * 60 * 1000);
    });

    it("handles zero hours", () => {
      const now = new Date("2025-02-03T00:00:00Z");
      const result = computeLiveExpiry(now, 0);
      expect(result.getTime()).toBe(now.getTime());
    });
  });
});
