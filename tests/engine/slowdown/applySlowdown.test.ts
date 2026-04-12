import { describe, it, expect } from "vitest";
import {
  applySlowdown,
  aggregateAdjustedMileSplits,
} from "@engine/slowdown/applySlowdown";
import type { SegmentResult, MileSplit } from "@engine/types";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";
import { METERS_PER_MILE } from "@engine/utils/units";

function makeSegmentResults(count: number, distEach: number): SegmentResult[] {
  const pacePerMeter = 720 / METERS_PER_MILE; // ~12:00/mi
  let cumElapsed = 0;
  return Array.from({ length: count }, (_, i) => {
    const time = distEach * pacePerMeter;
    cumElapsed += time;
    return {
      segmentId: i,
      startDistance: i * distEach,
      endDistance: (i + 1) * distEach,
      distance: distEach,
      avgGradePct: 0,
      modelValue: 1,
      targetPaceSecPerMeter: pacePerMeter,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

function noSlowdown(): SlowdownScenarioConfig {
  return {
    preset: "none",
    mode: "forecast",
    onsetDistanceMeters: 0,
    rampDistanceMeters: 0,
    plateauSlowdownFraction: 0,
  };
}

function simpleSlowdown(): SlowdownScenarioConfig {
  return {
    preset: "custom",
    mode: "forecast",
    onsetDistanceMeters: 5000,
    rampDistanceMeters: 0,
    plateauSlowdownFraction: 0.1,
  };
}

describe("applySlowdown", () => {
  it("leaves baseline unchanged when preset is none", () => {
    const segs = makeSegmentResults(10, 1000);
    const adjusted = applySlowdown(segs, noSlowdown());
    for (let i = 0; i < adjusted.length; i++) {
      expect(adjusted[i]!.slowdownFraction).toBe(0);
      expect(adjusted[i]!.adjustedPaceSecPerMeter).toBeCloseTo(
        segs[i]!.targetPaceSecPerMeter,
        6
      );
    }
  });

  it("applies slowdown fraction after onset", () => {
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());
    // Segment at index 4: midpoint = 4500, before onset
    expect(adjusted[4]!.slowdownFraction).toBe(0);
    // Segment at index 5: midpoint = 5500, after onset
    expect(adjusted[5]!.slowdownFraction).toBeCloseTo(0.1, 6);
    // Segment at index 10: midpoint = 10500, after onset
    expect(adjusted[10]!.slowdownFraction).toBeCloseTo(0.1, 6);
  });

  it("adjusted finish time is slower than baseline when slowdown > 0", () => {
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());
    const baselineFinish = segs[segs.length - 1]!.cumulativeElapsedSec;
    const adjustedFinish = adjusted[adjusted.length - 1]!.cumulativeAdjustedElapsedSec;
    expect(adjustedFinish).toBeGreaterThan(baselineFinish);
  });

  it("cumulative adjusted elapsed is monotonically increasing", () => {
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());
    for (let i = 1; i < adjusted.length; i++) {
      expect(adjusted[i]!.cumulativeAdjustedElapsedSec).toBeGreaterThan(
        adjusted[i - 1]!.cumulativeAdjustedElapsedSec
      );
    }
  });
});

describe("aggregateAdjustedMileSplits", () => {
  it("produces same number of splits as baseline", () => {
    const distPerSeg = 160.934;
    const numSegs = 50;
    const segs = makeSegmentResults(numSegs, distPerSeg);
    const adjusted = applySlowdown(segs, noSlowdown());
    const baselineSplits: MileSplit[] = [
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 2, paceSecPerMile: 720, elapsedSec: 1440 },
      { mile: 3, paceSecPerMile: 720, elapsedSec: 2160 },
      { mile: 4, paceSecPerMile: 720, elapsedSec: 2880 },
      { mile: 5, paceSecPerMile: 720, elapsedSec: 3600 },
    ];
    const adjSplits = aggregateAdjustedMileSplits(segs, adjusted, baselineSplits);
    expect(adjSplits).toHaveLength(baselineSplits.length);
  });

  it("adjusted splits match baseline when no slowdown", () => {
    const distPerSeg = 160.934;
    const numSegs = 50;
    const segs = makeSegmentResults(numSegs, distPerSeg);
    const adjusted = applySlowdown(segs, noSlowdown());
    const baselineSplits: MileSplit[] = [
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 2, paceSecPerMile: 720, elapsedSec: 1440 },
      { mile: 3, paceSecPerMile: 720, elapsedSec: 2160 },
    ];
    const adjSplits = aggregateAdjustedMileSplits(segs, adjusted, baselineSplits);
    for (const split of adjSplits) {
      expect(split.adjustedPaceSecPerMile).toBeCloseTo(split.baselinePaceSecPerMile, 0);
    }
  });
});
