import { describe, it, expect } from "vitest";
import { stravaInferredModel } from "@engine/models/stravaInferred";

describe("stravaInferredModel", () => {
  const mult = stravaInferredModel.multiplier!;

  it("has correct metadata", () => {
    expect(stravaInferredModel.id).toBe("strava_inferred");
    expect(stravaInferredModel.kind).toBe("interpolation_model");
    expect(stravaInferredModel.provenance).toBe("user-inferred");
    expect(stravaInferredModel.supportsDownhill).toBe(true);
    expect(stravaInferredModel.warning).toBeDefined();
  });

  it("returns ~1.0 at flat", () => {
    expect(mult(0)).toBeCloseTo(1.0, 1);
  });

  it("returns ~0.88 around -9% to -10%", () => {
    const m = mult(-10);
    expect(m).toBeGreaterThan(0.83);
    expect(m).toBeLessThan(0.93);
  });

  it("returns ~1.0 around -18%", () => {
    const m = mult(-18);
    expect(m).toBeGreaterThan(0.95);
    expect(m).toBeLessThan(1.10);
  });

  it("returns > 1 on uphill", () => {
    expect(mult(5)).toBeGreaterThan(1);
    expect(mult(10)).toBeGreaterThan(1);
  });

  it("uphill is monotone increasing for positive grades", () => {
    const grades = [0, 2, 5, 8, 10, 15, 20];
    for (let i = 1; i < grades.length; i++) {
      expect(mult(grades[i])).toBeGreaterThan(mult(grades[i - 1]));
    }
  });

  it("uses fallback quadratic outside data range", () => {
    const m25 = mult(25);
    // Fallback: 1 + 0.029*25 + 0.0015*25^2 = 1 + 0.725 + 0.9375 = 2.6625
    expect(m25).toBeCloseTo(2.6625, 2);
  });

  it("returns finite values across a wide range", () => {
    for (let g = -30; g <= 30; g += 1) {
      expect(Number.isFinite(mult(g))).toBe(true);
    }
  });
});
