import { describe, expect, it } from "vitest";
import { pickSmallestMissingPositive } from "../src/lib/pages";

describe("pages", () => {
  describe("pickSmallestMissingPositive", () => {
    it("returns 1 for empty array", () => {
      expect(pickSmallestMissingPositive([])).toBe(1);
    });

    it("returns next after contiguous from 1", () => {
      expect(pickSmallestMissingPositive([1])).toBe(2);
      expect(pickSmallestMissingPositive([1, 2])).toBe(3);
      expect(pickSmallestMissingPositive([1, 2, 3])).toBe(4);
    });

    it("returns 1 when 1 is missing", () => {
      expect(pickSmallestMissingPositive([2])).toBe(1);
      expect(pickSmallestMissingPositive([2, 3])).toBe(1);
    });

    it("returns first gap in sorted list", () => {
      expect(pickSmallestMissingPositive([1, 3])).toBe(2);
      expect(pickSmallestMissingPositive([1, 2, 4])).toBe(3);
      expect(pickSmallestMissingPositive([1, 2, 3, 5, 6])).toBe(4);
    });

    it("handles duplicates by treating as contiguous", () => {
      // [1,1,2] → expected 1, then 1 matches, expected 2, then 1 no match and 1 < 2 so continue; 2 matches expected 3; end → 3
      expect(pickSmallestMissingPositive([1, 1, 2])).toBe(3);
    });
  });
});
