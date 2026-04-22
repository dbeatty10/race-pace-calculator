import type {
  Microsegment,
  SegmentResult,
  PaceModel,
  PlanSummary,
  PlanningMode,
} from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function computeSummary(
  microsegments: Microsegment[],
  results: SegmentResult[],
  model: PaceModel,
  targetFinishTimeSec: number,
  planningMode: PlanningMode = "target_time",
  gpxDistanceMeters?: number,
  officialDistanceMeters?: number
): PlanSummary {
  const last = microsegments[microsegments.length - 1]!;
  const gpxDist = gpxDistanceMeters ?? last.endDistance;
  const officialDist = officialDistanceMeters ?? gpxDist;
  const officialOverGpx = officialDist / gpxDist;

  let totalClimb = 0;
  let totalDescent = 0;
  for (const seg of microsegments) {
    const diff = seg.endElevation - seg.startElevation;
    if (diff > 0) totalClimb += diff;
    else totalDescent += Math.abs(diff);
  }

  const lastResult = results[results.length - 1]!;
  const computedFinishTimeSec = lastResult.cumulativeElapsedSec;

  const weightedDistance = results.reduce(
    (sum, r) => sum + r.distance * r.modelValue,
    0
  );

  const flatEqPaceSecPerMeterGpx =
    model.kind === "demand_model"
      ? computedFinishTimeSec / gpxDist
      : targetFinishTimeSec / weightedDistance;

  // Scale to per-official-mile: pace_official = pace_gpx / (official/gpx)
  const flatEquivalentPaceSecPerMile =
    (flatEqPaceSecPerMeterGpx * METERS_PER_MILE) / officialOverGpx;

  return {
    planningMode,
    modelId: model.id,
    modelLabel: model.label,
    targetFinishTimeSec,
    computedFinishTimeSec,
    courseLengthMeters: officialDist,
    gpxDistanceMeters: gpxDist,
    totalClimbMeters: totalClimb,
    totalDescentMeters: totalDescent,
    flatEquivalentPaceSecPerMile,
    weightedDistanceMeters: weightedDistance,
  };
}
