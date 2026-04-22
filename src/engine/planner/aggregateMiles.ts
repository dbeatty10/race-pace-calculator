import type { SegmentResult, SplitResult } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function aggregateMileSplits(segments: SegmentResult[]): SplitResult[] {
  if (segments.length === 0) return [];

  const last = segments[segments.length - 1]!;
  const totalDistance = last.endDistance;
  const totalMiles = Math.ceil(totalDistance / METERS_PER_MILE);
  const splits: SplitResult[] = [];

  let prevMileElapsed = 0;

  for (let mile = 1; mile <= totalMiles; mile++) {
    const mileEndDist = mile * METERS_PER_MILE;
    let elapsed = 0;

    // Sum time for all segments up to this mile marker
    for (const seg of segments) {
      if (seg.endDistance <= mileEndDist) {
        // Entire segment is within this mile boundary
        elapsed = seg.cumulativeElapsedSec;
      } else if (seg.startDistance < mileEndDist) {
        // Partial segment — interpolate
        const fraction =
          (mileEndDist - seg.startDistance) / seg.distance;
        elapsed =
          (seg.cumulativeElapsedSec - seg.targetTimeSec) +
          fraction * seg.targetTimeSec;
        break;
      } else {
        break;
      }
    }

    // If mile marker is past course end, use total time
    if (mileEndDist >= totalDistance) {
      elapsed = last.cumulativeElapsedSec;
    }

    const mileTime = elapsed - prevMileElapsed;

    // For the last partial mile, compute pace relative to actual distance
    let mileDistance = METERS_PER_MILE;
    if (mile === totalMiles && totalDistance < mileEndDist) {
      mileDistance = totalDistance - (mile - 1) * METERS_PER_MILE;
    }

    const paceSecPerMile =
      mileDistance > 0 ? (mileTime / mileDistance) * METERS_PER_MILE : 0;

    splits.push({
      label: String(mile),
      distanceM: Math.min(mileEndDist, totalDistance),
      paceSecPerMile,
      elapsedSec: elapsed,
    });

    prevMileElapsed = elapsed;
  }

  return splits;
}
