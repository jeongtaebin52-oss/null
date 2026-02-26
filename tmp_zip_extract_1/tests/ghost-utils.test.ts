import { describe, expect, it } from "vitest";
import { simplifyGhostPoints, type GhostPoint } from "../src/lib/ghost-utils";

describe("ghost-utils", () => {
  describe("simplifyGhostPoints", () => {
    it("returns points unchanged when length <= maxPoints", () => {
      const points: GhostPoint[] = [
        { t: 0, x: 0, y: 0 },
        { t: 100, x: 10, y: 10 },
      ];
      expect(simplifyGhostPoints(points, 5)).toEqual(points);
      expect(simplifyGhostPoints(points, 2)).toEqual(points);
    });

    it("returns at least first and last point when simplifying", () => {
      const points: GhostPoint[] = [
        { t: 0, x: 0, y: 0 },
        { t: 50, x: 5, y: 5 },
        { t: 100, x: 10, y: 10 },
      ];
      const out = simplifyGhostPoints(points, 2);
      expect(out.length).toBeGreaterThanOrEqual(2);
      expect(out[0]).toEqual(points[0]);
      expect(out[out.length - 1]).toEqual(points[points.length - 1]);
    });

    it("reduces length when above maxPoints", () => {
      const points: GhostPoint[] = Array.from({ length: 20 }, (_, i) => ({
        t: i * 50,
        x: i * 2,
        y: i * 2,
      }));
      const out = simplifyGhostPoints(points, 5);
      expect(out.length).toBeLessThanOrEqual(5);
      expect(out[0]).toEqual(points[0]);
      expect(out[out.length - 1]).toEqual(points[points.length - 1]);
    });
  });
});
