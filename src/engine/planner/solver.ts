import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";
import { bisect } from "@engine/utils/bisect";

function solveDirectMultiplier(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  const mult = model.multiplier!;

  // flatEqPace = targetTime / sum(d_i * M(g_i))
  const weightedDistance = segments.reduce(
    (sum, seg) => sum + seg.distance * mult(seg.avgGradePct),
    0
  );
  const flatEqPace = targetTimeSec / weightedDistance; // sec per meter

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const m = mult(seg.avgGradePct);
    const pace = flatEqPace * m;
    const time = seg.distance * pace;
    cumElapsed += time;

    return {
      segmentId: i,
      startDistance: seg.startDistance,
      endDistance: seg.endDistance,
      distance: seg.distance,
      avgGradePct: seg.avgGradePct,
      modelValue: m,
      targetPaceSecPerMeter: pace,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

function solveDemandModel(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  const hillSpeed = model.hillSpeedFromFlatSpeed!;

  function totalTimeForFlatSpeed(flatSpeedMps: number): number {
    let total = 0;
    for (const seg of segments) {
      const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
      total += seg.distance / vh;
    }
    return total;
  }

  // Outer solve: find flatSpeedMps such that totalTime = targetTimeSec
  // totalTime decreases as v increases → f(v) = totalTime(v) - target is decreasing
  // lo is slow (large time), hi is fast (small time)
  const flatSpeedMps = bisect(
    (v) => totalTimeForFlatSpeed(v) - targetTimeSec,
    0.3, // very slow: ~55 min/mi
    10.0 // very fast: ~2:40/mi
  );

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
    const pace = 1 / vh; // sec per meter
    const time = seg.distance / vh;
    cumElapsed += time;

    return {
      segmentId: i,
      startDistance: seg.startDistance,
      endDistance: seg.endDistance,
      distance: seg.distance,
      avgGradePct: seg.avgGradePct,
      modelValue: vh,
      targetPaceSecPerMeter: pace,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

export function solveWholeCourse(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  if (model.kind === "demand_model" && model.hillSpeedFromFlatSpeed) {
    return solveDemandModel(segments, model, targetTimeSec);
  }

  if (model.multiplier) {
    return solveDirectMultiplier(segments, model, targetTimeSec);
  }

  throw new Error(`Model "${model.id}" has neither multiplier nor hillSpeedFromFlatSpeed`);
}
