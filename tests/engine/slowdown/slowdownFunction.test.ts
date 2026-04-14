import { describe, it, expect } from "vitest";
import { slowdownFraction } from "@engine/slowdown/slowdownFunction";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";

function makeConfig(
  overrides: Partial<SlowdownScenarioConfig> = {}
): SlowdownScenarioConfig {
  return {
    preset: "custom",
    mode: "forecast",
    onsetDistanceMeters: 30000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.1,
    ...overrides,
  };
}

describe("slowdownFraction", () => {
  it("returns 0 before onset", () => {
    const config = makeConfig({ onsetDistanceMeters: 30000 });
    expect(slowdownFraction(0, config)).toBe(0);
    expect(slowdownFraction(15000, config)).toBe(0);
    expect(slowdownFraction(29999, config)).toBe(0);
  });

  it("returns 0 at onset boundary", () => {
    const config = makeConfig({ onsetDistanceMeters: 30000 });
    expect(slowdownFraction(30000, config)).toBeCloseTo(0, 6);
  });

  it("ramps linearly from 0 to plateau", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 4000,
      plateauSlowdownFraction: 0.2,
    });
    expect(slowdownFraction(32000, config)).toBeCloseTo(0.1, 4);
    expect(slowdownFraction(31000, config)).toBeCloseTo(0.05, 4);
  });

  it("returns plateau after ramp", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 3000,
      plateauSlowdownFraction: 0.15,
    });
    expect(slowdownFraction(33000, config)).toBeCloseTo(0.15, 6);
    expect(slowdownFraction(40000, config)).toBeCloseTo(0.15, 6);
  });

  it("returns 0 for none preset", () => {
    const config = makeConfig({
      preset: "none",
      plateauSlowdownFraction: 0,
    });
    expect(slowdownFraction(50000, config)).toBe(0);
  });

  it("behaves as step change when ramp is 0", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0.2,
    });
    expect(slowdownFraction(29999, config)).toBe(0);
    expect(slowdownFraction(30000, config)).toBeCloseTo(0.2, 6);
    expect(slowdownFraction(30001, config)).toBeCloseTo(0.2, 6);
  });

  it("is monotonically nondecreasing", () => {
    const config = makeConfig();
    const distances = [0, 10000, 20000, 29000, 30000, 31000, 32000, 33000, 40000];
    const values = distances.map((d) => slowdownFraction(d, config));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it("never activates when onset is beyond finish distance", () => {
    const config = makeConfig({ onsetDistanceMeters: 50000 });
    expect(slowdownFraction(42000, config)).toBe(0);
  });
});
