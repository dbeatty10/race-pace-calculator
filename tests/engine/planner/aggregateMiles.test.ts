import { describe, it, expect } from "vitest";
import { aggregateSplits } from "@engine/planner/aggregateMiles";
import { mileSplitPoints } from "@engine/planner/splitSchedules";
import type { SegmentResult } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

function makeResults(
  count: number,
  distEach: number,
  paceSecPerMeter: number
): SegmentResult[] {
  let cumElapsed = 0;
  return Array.from({ length: count }, (_, i) => {
    const time = distEach * paceSecPerMeter;
    cumElapsed += time;
    return {
      segmentId: i,
      startDistance: i * distEach,
      endDistance: (i + 1) * distEach,
      distance: distEach,
      avgGradePct: 0,
      modelValue: 1,
      targetPaceSecPerMeter: paceSecPerMeter,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

describe("aggregateSplits — mile boundaries", () => {
  it("produces correct number of splits for 5-mile course", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateSplits(results, mileSplitPoints(50 * segDist));
    expect(splits).toHaveLength(5);
  });

  it("each split has correct pace on uniform course", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateSplits(results, mileSplitPoints(50 * segDist));
    for (const split of splits) {
      expect(split.paceSecPerMile).toBeCloseTo(600, 0);
    }
  });

  it("elapsed time increases with each split", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateSplits(results, mileSplitPoints(50 * segDist));
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i]!.elapsedSec).toBeGreaterThan(splits[i - 1]!.elapsedSec);
    }
  });

  it("final elapsed matches total segment time", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateSplits(results, mileSplitPoints(50 * segDist));
    const lastSplit = splits[splits.length - 1]!;
    const lastSeg = results[results.length - 1]!;
    expect(lastSplit.elapsedSec).toBeCloseTo(lastSeg.cumulativeElapsedSec, 0);
  });

  it("handles partial final mile — 6 splits for 5.5-mile course", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(55, segDist, pace);
    const splits = aggregateSplits(results, mileSplitPoints(55 * segDist));
    expect(splits).toHaveLength(6);
    expect(splits[5]!.label).toBe("6");
  });
});

describe("aggregateSplits — custom split points", () => {
  it("computes correct elapsed at arbitrary distance markers", () => {
    // 10 segments of 1000m, pace = 1 sec/m → 10000m in 10000s
    const results = makeResults(10, 1000, 1.0);
    const splits = aggregateSplits(results, [
      { label: "5K", distanceM: 5000 },
      { label: "10K", distanceM: 10000 },
    ]);
    expect(splits).toHaveLength(2);
    expect(splits[0]!.elapsedSec).toBeCloseTo(5000, 0);
    expect(splits[1]!.elapsedSec).toBeCloseTo(10000, 0);
  });

  it("uses provided label in each SplitResult", () => {
    const results = makeResults(5, 1000, 1.0);
    const splits = aggregateSplits(results, [
      { label: "HALF", distanceM: 2500 },
    ]);
    expect(splits[0]!.label).toBe("HALF");
  });

  it("returns empty array when segments is empty", () => {
    const splits = aggregateSplits([], [{ label: "5K", distanceM: 5000 }]);
    expect(splits).toHaveLength(0);
  });

  it("returns empty array when splitPoints is empty", () => {
    const results = makeResults(5, 1000, 1.0);
    const splits = aggregateSplits(results, []);
    expect(splits).toHaveLength(0);
  });
});
