import { describe, it, expect } from "vitest";
import { bisect } from "@engine/utils/bisect";

describe("bisect", () => {
  it("finds the root of x^2 - 4 near x=2", () => {
    const root = bisect((x) => x * x - 4, 0, 5);
    expect(root).toBeCloseTo(2, 5);
  });

  it("finds the root of x^2 - 4 near x=-2", () => {
    const root = bisect((x) => x * x - 4, -5, 0);
    expect(root).toBeCloseTo(-2, 5);
  });

  it("returns exact root when landed on", () => {
    const root = bisect((x) => x - 3, 0, 6);
    expect(root).toBeCloseTo(3, 5);
  });

  it("throws when root is not bracketed", () => {
    expect(() => bisect((x) => x * x + 1, 0, 5)).toThrow("Root not bracketed");
  });

  it("respects tolerance", () => {
    const root = bisect((x) => x - Math.PI, 3, 4, 1e-10);
    expect(Math.abs(root - Math.PI)).toBeLessThan(1e-10);
  });

  it("returns lo if f(lo) is zero", () => {
    const root = bisect((x) => x - 2, 2, 5);
    expect(root).toBe(2);
  });

  it("returns hi if f(hi) is zero", () => {
    const root = bisect((x) => x - 5, 2, 5);
    expect(root).toBe(5);
  });
});
