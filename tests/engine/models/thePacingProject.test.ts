import { describe, it, expect } from "vitest";
import {
  thePacingProjectMultiplier,
  thePacingProjectModel,
} from "@engine/models/thePacingProject";

function ctx(speedMps: number) {
  return { refFlatSpeedMps: speedMps };
}

describe("thePacingProjectMultiplier", () => {
  it("has correct metadata", () => {
    expect(thePacingProjectModel.id).toBe("the_pacing_project_reconstructed");
    expect(thePacingProjectModel.kind).toBe("direct_multiplier");
    expect(thePacingProjectModel.provenance).toBe("reconstructed");
    expect(thePacingProjectModel.speedDependent).toBe(true);
    expect(thePacingProjectModel.gradePctMin).toBe(-26);
    expect(thePacingProjectModel.gradePctMax).toBe(26);
    expect(thePacingProjectModel.supportsDownhill).toBe(true);
    expect(thePacingProjectModel.warning).toBeDefined();
  });

  it("returns exactly 1.0 at grade 0 for various speeds", () => {
    // M(0, v) = 1 for all v by construction (all terms contain g as a factor)
    for (const v of [2.0, 3.0, 3.5, 4.0, 5.0]) {
      expect(thePacingProjectMultiplier(0, ctx(v))).toBeCloseTo(1.0, 12);
    }
  });

  it("returns > 1 for moderate uphill", () => {
    expect(thePacingProjectMultiplier(5, ctx(3.0))).toBeGreaterThan(1.0);
    expect(thePacingProjectMultiplier(10, ctx(3.0))).toBeGreaterThan(1.0);
  });

  it("steeper uphill produces higher multiplier", () => {
    const m5 = thePacingProjectMultiplier(5, ctx(3.0));
    const m10 = thePacingProjectMultiplier(10, ctx(3.0));
    expect(m10).toBeGreaterThan(m5);
  });

  it("returns < 1 for moderate downhill", () => {
    expect(thePacingProjectMultiplier(-5, ctx(3.0))).toBeLessThan(1.0);
  });

  it("multiplier varies with speed for non-zero grade", () => {
    const mSlow = thePacingProjectMultiplier(10, ctx(2.0));
    const mFast = thePacingProjectMultiplier(10, ctx(4.5));
    // Speed-dependent: the two values should differ
    expect(Math.abs(mFast - mSlow)).toBeGreaterThan(0.01);
  });

  it("produces finite positive values across the declared grade range", () => {
    for (let g = -26; g <= 26; g += 2) {
      for (const v of [2.0, 3.0, 4.0, 5.0]) {
        const m = thePacingProjectMultiplier(g, ctx(v));
        expect(Number.isFinite(m)).toBe(true);
        expect(m).toBeGreaterThan(0);
      }
    }
  });

  it("throws when context is missing", () => {
    expect(() => thePacingProjectMultiplier(5)).toThrow(
      "requires refFlatSpeedMps"
    );
    expect(() => thePacingProjectMultiplier(5, {})).toThrow(
      "requires refFlatSpeedMps"
    );
  });

  // Regression values: compute a few known multiplier values to lock in
  it("regression: known multiplier values", () => {
    // ~8:00/mi pace ≈ 3.352 m/s ≈ 7.5 mph
    const v = 3.352;
    // At 5% uphill
    const m5up = thePacingProjectMultiplier(5, ctx(v));
    expect(m5up).toBeGreaterThan(1.05);
    expect(m5up).toBeLessThan(1.30);

    // At 10% uphill
    const m10up = thePacingProjectMultiplier(10, ctx(v));
    expect(m10up).toBeGreaterThan(1.15);
    expect(m10up).toBeLessThan(1.80);

    // At -5% downhill
    const m5down = thePacingProjectMultiplier(-5, ctx(v));
    expect(m5down).toBeGreaterThan(0.80);
    expect(m5down).toBeLessThan(1.0);
  });
});
