import { describe, it, expect } from "vitest";
import { compensateToTarget } from "@engine/slowdown/compensate";
import type { Microsegment } from "@engine/types";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";
import { minettiModel } from "@engine/models/minetti";

function makeFlatCourse(numSegments: number, distEach: number): Microsegment[] {
  return Array.from({ length: numSegments }, (_, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 100,
    endElevation: 100,
    avgGradePct: 0,
  }));
}

const slowdownConfig: SlowdownScenarioConfig = {
  preset: "classic_wall",
  mode: "compensate_to_target",
  onsetDistanceMeters: 30000,
  rampDistanceMeters: 3000,
  plateauSlowdownFraction: 0.3,
};

describe("compensateToTarget", () => {
  const segments = makeFlatCourse(263, 160.934);
  const userTargetTimeSec = 4 * 3600;

  it("adjusted finish time lands close to user target", () => {
    const result = compensateToTarget(segments, minettiModel, userTargetTimeSec, slowdownConfig);
    expect(result.adjustedFinishTimeSec).toBeCloseTo(userTargetTimeSec, -1);
  });

  it("internal target is faster than user target when slowdown > 0", () => {
    const result = compensateToTarget(segments, minettiModel, userTargetTimeSec, slowdownConfig);
    expect(result.internalTargetTimeSec).toBeLessThan(userTargetTimeSec);
  });

  it("returns baseline and adjusted segments", () => {
    const result = compensateToTarget(segments, minettiModel, userTargetTimeSec, slowdownConfig);
    expect(result.baselineSegments).toHaveLength(segments.length);
    expect(result.adjustedSegments).toHaveLength(segments.length);
  });

  it("warns when compensation requires aggressive internal target", () => {
    const extremeConfig: SlowdownScenarioConfig = {
      preset: "custom",
      mode: "compensate_to_target",
      onsetDistanceMeters: 10000,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0.6,
    };
    const result = compensateToTarget(segments, minettiModel, userTargetTimeSec, extremeConfig);
    expect(result.warning).toBeDefined();
  });
});
