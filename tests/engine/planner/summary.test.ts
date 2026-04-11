import { describe, it, expect } from "vitest";
import { computeSummary } from "@engine/planner/summary";
import type { Microsegment, SegmentResult, PaceModel } from "@engine/types";

const testModel: PaceModel = {
  id: "test",
  label: "Test Model",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: () => 1.0,
};

describe("computeSummary", () => {
  it("computes course length from segments", () => {
    const segs: Microsegment[] = [
      { startDistance: 0, endDistance: 1000, distance: 1000, startElevation: 0, endElevation: 10, avgGradePct: 1 },
      { startDistance: 1000, endDistance: 2000, distance: 1000, startElevation: 10, endElevation: 5, avgGradePct: -0.5 },
    ];
    const results: SegmentResult[] = [
      { segmentId: 0, startDistance: 0, endDistance: 1000, distance: 1000, avgGradePct: 1, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 300 },
      { segmentId: 1, startDistance: 1000, endDistance: 2000, distance: 1000, avgGradePct: -0.5, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 600 },
    ];
    const summary = computeSummary(segs, results, testModel, 600);

    expect(summary.courseLengthMeters).toBe(2000);
    expect(summary.totalClimbMeters).toBe(10);
    expect(summary.totalDescentMeters).toBe(5);
    expect(summary.targetFinishTimeSec).toBe(600);
    expect(summary.computedFinishTimeSec).toBeCloseTo(600);
    expect(summary.modelId).toBe("test");
    expect(summary.modelLabel).toBe("Test Model");
  });
});
