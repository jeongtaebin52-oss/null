import { describe, expect, it } from "vitest";
import { canPublishMore, isExpired } from "../src/lib/policy";

describe("policy helpers", () => {
  it("allows publish when slots remain", () => {
    expect(canPublishMore({ liveCount: 0, maxLive: 1 })).toBe(true);
    expect(canPublishMore({ liveCount: 1, maxLive: 1 })).toBe(false);
  });

  it("flags expiration based on timestamp", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    expect(isExpired({ expiresAt: new Date("2024-12-31T23:59:59Z"), now })).toBe(true);
    expect(isExpired({ expiresAt: new Date("2025-01-01T00:00:01Z"), now })).toBe(false);
  });
});
