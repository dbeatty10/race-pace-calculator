import type {
  Microsegment,
  SegmentResult,
  PaceModel,
  PlanSummary,
} from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function computeSummary(
  microsegments: Microsegment[],
  results: SegmentResult[],
  model: PaceModel,
  targetFinishTimeSec: number
): PlanSummary {
  const last = microsegments[microsegments.length - 1]!;
  const courseLengthMeters = last.endDistance;

  let totalClimb = 0;
  let totalDescent = 0;
  for (const seg of microsegments) {
    const diff = seg.endElevation - seg.startElevation;
    if (diff > 0) totalClimb += diff;
    else totalDescent += Math.abs(diff);
  }

  const lastResult = results[results.length - 1]!;
  const computedFinishTimeSec = lastResult.cumulativeElapsedSec;

  // Weighted distance: sum(d_i * modelValue_i)
  // For direct_multiplier: modelValue is the multiplier M
  // For demand_model: modelValue is the hill speed vh; use distance sum as weighted distance
  const weightedDistance = results.reduce(
    (sum, r) => sum + r.distance * r.modelValue,
    0
  );

  // Flat-equivalent pace
  const flatEqPaceSecPerMeter =
    model.kind === "demand_model"
      ? computedFinishTimeSec / courseLengthMeters
      : targetFinishTimeSec / weightedDistance;

  const flatEquivalentPaceSecPerMile = flatEqPaceSecPerMeter * METERS_PER_MILE;

  return {
    modelId: model.id,
    modelLabel: model.label,
    targetFinishTimeSec,
    computedFinishTimeSec,
    courseLengthMeters,
    totalClimbMeters: totalClimb,
    totalDescentMeters: totalDescent,
    flatEquivalentPaceSecPerMile,
    weightedDistanceMeters: weightedDistance,
  };
}
