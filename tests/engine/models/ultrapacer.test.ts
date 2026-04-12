import { describe, it, expect } from "vitest";
import { ultrapacerDefaultMultiplier, ultrapacerModel } from "@engine/models/ultrapacer";

describe("ultrapacerDefaultMultiplier", () => {
  it("returns 1.0 on flat (grade 0)", () => {
    expect(ultrapacerDefaultMultiplier(0)).toBeCloseTo(1.0, 6);
  });

  it("returns > 1 for moderate uphill (grade 10%)", () => {
    // f = 0.0021*100 + 0.034*10 = 0.21 + 0.34 = 0.55
    expect(ultrapacerDefaultMultiplier(10)).toBeCloseTo(1.55, 4);
  });

  it("returns < 1 for moderate downhill (grade -10%)", () => {
    // f = 0.0021*100 + 0.034*(-10) = 0.21 - 0.34 = -0.13
    expect(ultrapacerDefaultMultiplier(-10)).toBeCloseTo(0.87, 4);
  });

  it("uses upper linear branch for grade > 16", () => {
    // f = 0.1012*20 - 0.4624 = 2.024 - 0.4624 = 1.5616
    expect(ultrapacerDefaultMultiplier(20)).toBeCloseTo(2.5616, 4);
  });

  it("uses lower linear branch for grade < -22", () => {
    // f = -0.0584*(-25) - 0.0164 = 1.46 - 0.0164 = 1.4436
    expect(ultrapacerDefaultMultiplier(-25)).toBeCloseTo(2.4436, 4);
  });

  it("is monotonically increasing from -10 to +10", () => {
    const grades = [-10, -5, 0, 5, 10];
    const values = grades.map((g) => ultrapacerDefaultMultiplier(g));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe("ultrapacerModel", () => {
  it("has correct metadata", () => {
    expect(ultrapacerModel.id).toBe("ultrapacer_default");
    expect(ultrapacerModel.kind).toBe("direct_multiplier");
    expect(ultrapacerModel.multiplier).toBeDefined();
  });
});
