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

function makeBasicInputs() {
  const segs: Microsegment[] = [
    { startDistance: 0, endDistance: 1000, distance: 1000, startElevation: 0, endElevation: 10, avgGradePct: 1 },
    { startDistance: 1000, endDistance: 2000, distance: 1000, startElevation: 10, endElevation: 5, avgGradePct: -0.5 },
  ];
  const results: SegmentResult[] = [
    { segmentId: 0, startDistance: 0, endDistance: 1000, distance: 1000, avgGradePct: 1, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 300 },
    { segmentId: 1, startDistance: 1000, endDistance: 2000, distance: 1000, avgGradePct: -0.5, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 600 },
  ];
  return { segs, results };
}

describe("computeSummary", () => {
  it("reports courseLengthMeters = officialDistanceMeters and gpxDistanceMeters = GPX total", () => {
    const { segs, results } = makeBasicInputs();
    const summary = computeSummary(segs, results, testModel, 600, "target_time", 2000, 1980);

    expect(summary.courseLengthMeters).toBe(1980);   // official
    expect(summary.gpxDistanceMeters).toBe(2000);    // GPX
    expect(summary.totalClimbMeters).toBe(10);
    expect(summary.totalDescentMeters).toBe(5);
  });

  it("defaults to GPX distance when official equals GPX", () => {
    const { segs, results } = makeBasicInputs();
    const summary = computeSummary(segs, results, testModel, 600, "target_time", 2000, 2000);

    expect(summary.courseLengthMeters).toBe(2000);
    expect(summary.gpxDistanceMeters).toBe(2000);
  });

  it("scales flatEquivalentPaceSecPerMile to per-official-mile", () => {
    const { segs, results } = makeBasicInputs();
    // gpx = 2000m, official = 1980m, r = 0.99
    // flatEq pace in GPX = 600s / 2000m = 0.3 sec/m = 482.8 sec/mi (0.3 * 1609.344)
    // flatEq pace in official = 482.8 / 0.99 = 487.7 sec/mi
    const summary = computeSummary(segs, results, testModel, 600, "target_time", 2000, 1980);
    expect(summary.flatEquivalentPaceSecPerMile).toBeCloseTo(482.8 / 0.99, 1);
  });

  it("returns identical flatEquivalentPaceSecPerMile when official = GPX (r = 1)", () => {
    const { segs, results } = makeBasicInputs();
    const summary = computeSummary(segs, results, testModel, 600, "target_time", 2000, 2000);
    expect(summary.flatEquivalentPaceSecPerMile).toBeCloseTo(0.3 * 1609.344, 3);
  });
});
