import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";

function propagateMultiplier(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  const mult = model.multiplier!;
  const flatPaceSecPerMeter = 1 / flatSpeedMps;

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const m = mult(seg.avgGradePct);
    const pace = flatPaceSecPerMeter * m;
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

function propagateDemand(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  const hillSpeed = model.hillSpeedFromFlatSpeed!;

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
    const pace = 1 / vh;
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

export function propagateEffort(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  if (model.kind === "demand_model" && model.hillSpeedFromFlatSpeed) {
    return propagateDemand(segments, model, flatSpeedMps);
  }

  if (model.multiplier) {
    return propagateMultiplier(segments, model, flatSpeedMps);
  }

  throw new Error(
    `Model "${model.id}" has neither multiplier nor hillSpeedFromFlatSpeed`
  );
}
