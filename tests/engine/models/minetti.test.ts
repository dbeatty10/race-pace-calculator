import { describe, it, expect } from "vitest";
import { minettiModel } from "@engine/models/minetti";

describe("minettiModel", () => {
  const mult = minettiModel.multiplier!;

  it("has correct metadata", () => {
    expect(minettiModel.id).toBe("minetti");
    expect(minettiModel.kind).toBe("direct_multiplier");
    expect(minettiModel.provenance).toBe("paper");
    expect(minettiModel.supportsDownhill).toBe(true);
  });

  it("returns 1.0 on flat", () => {
    expect(mult(0)).toBeCloseTo(1.0, 6);
  });

  it("returns > 1 on uphill", () => {
    expect(mult(5)).toBeGreaterThan(1);
    expect(mult(10)).toBeGreaterThan(1);
    expect(mult(20)).toBeGreaterThan(1);
  });

  it("uphill is monotone increasing for positive grades", () => {
    const grades = [0, 2, 5, 8, 10, 15, 20];
    for (let i = 1; i < grades.length; i++) {
      expect(mult(grades[i]!)).toBeGreaterThan(mult(grades[i - 1]!));
    }
  });

  it("returns < 1 on moderate downhills", () => {
    expect(mult(-5)).toBeLessThan(1);
    expect(mult(-10)).toBeLessThan(1);
  });

  it("shows U-shape: steep downhill is harder than moderate downhill", () => {
    // Multiplier should decrease then increase as downhill gets steeper
    // The minimum is around -18%, so we test moderate, minimum region, and steep
    const m10 = mult(-10);
    const m18 = mult(-18);
    const m30 = mult(-30);
    expect(m18).toBeLessThan(m10);
    expect(m30).toBeGreaterThan(m18);
  });

  it("returns finite values across declared range", () => {
    for (let g = minettiModel.gradePctMin; g <= minettiModel.gradePctMax; g += 1) {
      expect(Number.isFinite(mult(g))).toBe(true);
    }
  });
});
