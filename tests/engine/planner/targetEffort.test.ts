import { describe, it, expect } from "vitest";
import { propagateEffort } from "@engine/planner/targetEffort";
import type { Microsegment, PaceModel } from "@engine/types";
import { paceSecPerMileToSpeedMps } from "@engine/utils/units";

// Simple test model: multiplier = 1 + 0.05 * gradePct
const testMultiplierModel: PaceModel = {
  id: "test_mult",
  label: "Test multiplier",
  kind: "direct_multiplier",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes: "Test",
  multiplier: (g: number) => 1 + 0.05 * g,
};

// Simple demand model where hillSpeed = flatSpeed / (1 + 0.05 * grade)
const testDemandModel: PaceModel = {
  id: "test_demand",
  label: "Test demand",
  kind: "demand_model",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes: "Test",
  hillSpeedFromFlatSpeed: (flatSpeed: number, gradePct: number) =>
    flatSpeed / (1 + 0.05 * gradePct),
};

function makeSegments(grades: number[], distEach: number): Microsegment[] {
  return grades.map((g, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 100,
    endElevation: 100 + (g / 100) * distEach,
    avgGradePct: g,
  }));
}

describe("propagateEffort — direct multiplier", () => {
  const segments = makeSegments([0, 5, -5, 10], 1000);
  // 12:00/mi flat pace
  const flatSpeedMps = paceSecPerMileToSpeedMps(720);

  it("flat segment uses the input flat pace", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    const flatSeg = result[0]!;
    const expectedPace = 1 / flatSpeedMps;
    expect(flatSeg.targetPaceSecPerMeter).toBeCloseTo(expectedPace, 6);
  });

  it("uphill segment is slower than flat", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    expect(result[1]!.targetPaceSecPerMeter).toBeGreaterThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("downhill segment is faster than flat", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    expect(result[2]!.targetPaceSecPerMeter).toBeLessThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("cumulative elapsed increases monotonically", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.cumulativeElapsedSec).toBeGreaterThan(
        result[i - 1]!.cumulativeElapsedSec
      );
    }
  });

  it("total time equals sum of segment times", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    const totalFromSum = result.reduce((s, r) => s + r.targetTimeSec, 0);
    const last = result[result.length - 1]!;
    expect(last.cumulativeElapsedSec).toBeCloseTo(totalFromSum, 6);
  });
});

describe("propagateEffort — demand model", () => {
  const segments = makeSegments([0, 5, -5], 1000);
  const flatSpeedMps = paceSecPerMileToSpeedMps(720);

  it("flat segment speed equals input flat speed", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    const flatSeg = result[0]!;
    const expectedSpeed = flatSpeedMps;
    expect(1 / flatSeg.targetPaceSecPerMeter).toBeCloseTo(expectedSpeed, 4);
  });

  it("uphill segment is slower than flat", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    expect(result[1]!.targetPaceSecPerMeter).toBeGreaterThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("total time equals sum of segment times", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    const totalFromSum = result.reduce((s, r) => s + r.targetTimeSec, 0);
    const last = result[result.length - 1]!;
    expect(last.cumulativeElapsedSec).toBeCloseTo(totalFromSum, 6);
  });
});
