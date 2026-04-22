import { describe, it, expect } from "vitest";
import { racePlanToCsv } from "@engine/export/csvExport";
import type { RacePlan, SplitResult, PlanSummary } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

function makePlan(splits: SplitResult[]): RacePlan {
  const summary: PlanSummary = {
    planningMode: "target_time",
    modelId: "test",
    modelLabel: "Test Model",
    targetFinishTimeSec: 3600,
    computedFinishTimeSec: 3600,
    courseLengthMeters: 16093.44,
    totalClimbMeters: 100,
    totalDescentMeters: 100,
    flatEquivalentPaceSecPerMile: 360,
    weightedDistanceMeters: 16093.44,
  };

  return {
    summary,
    segments: [],
    mileSplits: splits,
    climbs: [],
    warnings: [],
  };
}

describe("racePlanToCsv", () => {
  it("produces header row and data rows", () => {
    const plan = makePlan([
      { label: "1", distanceM: METERS_PER_MILE,     paceSecPerMile: 720, elapsedSec: 720  },
      { label: "2", distanceM: 2 * METERS_PER_MILE, paceSecPerMile: 750, elapsedSec: 1470 },
    ]);
    const csv = racePlanToCsv(plan);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Split,Pace (/mi),Elapsed Time");
    expect(lines).toHaveLength(3);
  });

  it("formats pace as mm:ss", () => {
    const plan = makePlan([
      { label: "1", distanceM: METERS_PER_MILE, paceSecPerMile: 720, elapsedSec: 720 },
    ]);
    const csv = racePlanToCsv(plan);
    expect(csv).toContain("12:00");
  });

  it("returns empty CSV for no splits", () => {
    const plan = makePlan([]);
    const csv = racePlanToCsv(plan);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
  });
});
