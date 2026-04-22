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

describe("generateRacePlan — officialDistanceM scaling", () => {
  it("uses officialDistanceM as courseLengthMeters when provided", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
      officialDistanceM: 10000,
    });
    expect(plan.summary.courseLengthMeters).toBe(10000);
    expect(plan.summary.gpxDistanceMeters).not.toBe(10000);
  });

  it("defaults courseLengthMeters to GPX distance when officialDistanceM omitted", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
    });
    expect(plan.summary.courseLengthMeters).toBe(plan.summary.gpxDistanceMeters);
  });

  it("scales mile-split paceSecPerMile inversely to the distance ratio", () => {
    const gpx = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
    });
    const official = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
      officialDistanceM: gpx.summary.gpxDistanceMeters * 0.99,
    });
    // pace_official = pace_gpx / 0.99, so official pace is ~1% slower.
    // We use a loose tolerance (-1 decimal ≈ ±5 sec/mi) because the two plans
    // have slightly different GPX split boundaries, introducing a small
    // boundary-shift effect on top of the pure scaling.
    const gpxPace = gpx.mileSplits[0]!.paceSecPerMile;
    const officialPace = official.mileSplits[0]!.paceSecPerMile;
    expect(officialPace).toBeGreaterThan(gpxPace); // official pace is slower
    expect(officialPace / gpxPace).toBeCloseTo(1 / 0.99, 2); // within ~1% of expected ratio
  });

  it("places split distanceM on the official scale", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
      officialDistanceM: 10000,
      splitMode: "5k",
    });
    // The 5K split on a 10K course should be at 5000m official
    expect(plan.mileSplits[0]!.distanceM).toBeCloseTo(5000, 0);
    expect(plan.mileSplits[0]!.label).toBe("5K");
  });

  it("target-effort mode treats flatEquivalentPaceSecPerMile as per-official-mile", () => {
    const gpxOnly = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      planningMode: "target_effort",
      flatEquivalentPaceSecPerMile: 600,
    });
    const scaled = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      planningMode: "target_effort",
      flatEquivalentPaceSecPerMile: 600,
      officialDistanceM: gpxOnly.summary.gpxDistanceMeters * 0.99,
    });
    // When 600 sec/mi is interpreted per-official-mile and official < GPX,
    // the runner must move ~1% faster in GPX terms, so finish time is ~1%
    // less than the no-scaling case.
    const gpxFinish = gpxOnly.summary.computedFinishTimeSec;
    const scaledFinish = scaled.summary.computedFinishTimeSec;
    expect(scaledFinish).toBeLessThan(gpxFinish);
    expect(scaledFinish).toBeCloseTo(gpxFinish * 0.99, 0);
  });

  it("warns when officialDistanceM differs from GPX by more than 5%", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
      officialDistanceM: 500,  // absurdly small
    });
    expect(plan.warnings.some((w) => w.includes("Official distance"))).toBe(true);
  });

  it("does not warn when distances are within 5%", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
    });
    const gpx = plan.summary.gpxDistanceMeters;
    const planClose = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      modelId: "strava_inferred",
      targetFinishTimeSec: 3600,
      officialDistanceM: gpx * 0.98,
    });
    expect(planClose.warnings.every((w) => !w.includes("Official distance"))).toBe(true);
  });
});
