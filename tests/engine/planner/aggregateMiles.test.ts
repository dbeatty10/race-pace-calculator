import { describe, it, expect } from "vitest";
import { aggregateMileSplits } from "@engine/planner/aggregateMiles";
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

describe("aggregateMileSplits", () => {
  it("produces correct number of mile splits", () => {
    // 5 miles = 5 * 1609.344m, using 160.934m segments (~0.1mi) → 50 segments
    const segDist = METERS_PER_MILE / 10; // 160.9344m
    const pace = 600 / METERS_PER_MILE; // 10:00/mi in sec/m
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    expect(splits.length).toBe(5);
  });

  it("each split has correct pace on uniform course", () => {
    const segDist = METERS_PER_MILE / 10;
    const pacePerMile = 600; // 10:00/mi
    const pace = pacePerMile / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    for (const split of splits) {
      expect(split.paceSecPerMile).toBeCloseTo(600, 0);
    }
  });

  it("elapsed time increases with each mile", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i]!.elapsedSec).toBeGreaterThan(splits[i - 1]!.elapsedSec);
    }
  });

  it("final elapsed matches total segment time", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    const lastSplit = splits[splits.length - 1]!;
    const lastSegment = results[results.length - 1]!;
    expect(lastSplit.elapsedSec).toBeCloseTo(lastSegment.cumulativeElapsedSec, 0);
  });

  it("handles partial final mile", () => {
    // 5.5 miles of segments
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(55, segDist, pace);
    const splits = aggregateMileSplits(results);
    // Should have 6 entries: miles 1-5 plus partial mile 6
    expect(splits.length).toBe(6);
    expect(splits[5]!.mile).toBe(6);
  });
});
