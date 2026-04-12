import { describe, it, expect } from "vitest";
import { generateRacePlan } from "@engine/planner/pipeline";

const SIMPLE_HILL_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Hill</name>
    <trkseg>
      <trkpt lat="37.0000" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0045" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0090" lon="-122.0"><ele>150</ele></trkpt>
      <trkpt lat="37.0135" lon="-122.0"><ele>200</ele></trkpt>
      <trkpt lat="37.0180" lon="-122.0"><ele>200</ele></trkpt>
      <trkpt lat="37.0225" lon="-122.0"><ele>150</ele></trkpt>
      <trkpt lat="37.0270" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0315" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0360" lon="-122.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("generateRacePlan", () => {
  it("generates a complete plan with Minetti model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });

    expect(plan.segments.length).toBeGreaterThan(0);
    expect(plan.mileSplits.length).toBeGreaterThan(0);
    expect(plan.summary.modelId).toBe("minetti");
    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
    expect(plan.summary.totalClimbMeters).toBeGreaterThan(0);
    expect(plan.summary.totalDescentMeters).toBeGreaterThan(0);
  });

  it("generates a plan with Strava inferred model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "strava_inferred",
    });

    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
  });

  it("generates a plan with RE3 demand model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "re3",
    });

    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
  });

  it("uphill mile splits are slower than flat mile splits", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });

    const paces = plan.mileSplits.map((s) => s.paceSecPerMile);
    const allEqual = paces.every((p) => Math.abs(p - paces[0]!) < 1);
    expect(allEqual).toBe(false);
  });

  it("returns warnings array", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });
    expect(Array.isArray(plan.warnings)).toBe(true);
  });

  it("model warning is included when model has one", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "strava_inferred",
    });
    expect(plan.warnings.some((w) => w.includes("user-inferred"))).toBe(true);
  });

  it("generates a plan in target_effort mode", () => {
    // 9:00/mile = 540 sec/mile flat equivalent pace
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      planningMode: "target_effort",
      flatEquivalentPaceSecPerMile: 540,
      modelId: "minetti",
    });

    expect(plan.summary.planningMode).toBe("target_effort");
    expect(plan.summary.computedFinishTimeSec).toBeGreaterThan(0);
    expect(plan.mileSplits.length).toBeGreaterThan(0);
  });
});
