import { describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp, pruneRateLimitStore } from "../src/lib/rate-limit";

function mockRequest(headers: Record<string, string>): Request {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  } as Request;
}

describe("rate-limit", () => {
  describe("getClientIp", () => {
    it("uses x-forwarded-for first when present", () => {
      const req = mockRequest({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8 " });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("uses x-real-ip when x-forwarded-for absent", () => {
      const req = mockRequest({ "x-real-ip": "10.0.0.1" });
      expect(getClientIp(req)).toBe("10.0.0.1");
    });

    it("returns unknown when no ip headers", () => {
      const req = mockRequest({});
      expect(getClientIp(req)).toBe("unknown");
    });
  });

  describe("checkRateLimit", () => {
    const windowMs = 60_000;
    const maxPerWindow = 3;

    it("allows requests under limit", async () => {
      pruneRateLimitStore();
      const req = mockRequest({ "x-real-ip": "192.168.1.100" });
      expect((await checkRateLimit(req, maxPerWindow, windowMs)).allowed).toBe(true);
      expect((await checkRateLimit(req, maxPerWindow, windowMs)).allowed).toBe(true);
      expect((await checkRateLimit(req, maxPerWindow, windowMs)).allowed).toBe(true);
    });

    it("rejects when over limit", async () => {
      pruneRateLimitStore();
      const req = mockRequest({ "x-real-ip": "192.168.1.101" });
      await checkRateLimit(req, maxPerWindow, windowMs);
      await checkRateLimit(req, maxPerWindow, windowMs);
      await checkRateLimit(req, maxPerWindow, windowMs);
      expect((await checkRateLimit(req, maxPerWindow, windowMs)).allowed).toBe(false);
    });

    it("different IPs have separate counters", async () => {
      pruneRateLimitStore();
      const reqA = mockRequest({ "x-real-ip": "10.0.0.1" });
      const reqB = mockRequest({ "x-real-ip": "10.0.0.2" });
      await checkRateLimit(reqA, 1, windowMs);
      await checkRateLimit(reqA, 1, windowMs); // over for A
      expect((await checkRateLimit(reqB, 1, windowMs)).allowed).toBe(true);
    });
  });
});
