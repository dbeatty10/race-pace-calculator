import type { SegmentResult, MileSplit } from "@engine/types";
import type {
  SlowdownScenarioConfig,
  AdjustedSegment,
  AdjustedMileSplit,
} from "./types";
import { slowdownFraction } from "./slowdownFunction";
import { METERS_PER_MILE } from "@engine/utils/units";

export function applySlowdown(
  segments: SegmentResult[],
  config: SlowdownScenarioConfig
): AdjustedSegment[] {
  let cumAdjustedElapsed = 0;

  return segments.map((seg) => {
    const midDistance = (seg.startDistance + seg.endDistance) / 2;
    const sf = slowdownFraction(midDistance, config);
    const adjustedPace = seg.targetPaceSecPerMeter * (1 + sf);
    const adjustedTime = seg.distance * adjustedPace;
    cumAdjustedElapsed += adjustedTime;

    return {
      segmentId: seg.segmentId,
      slowdownFraction: sf,
      baselinePaceSecPerMeter: seg.targetPaceSecPerMeter,
      adjustedPaceSecPerMeter: adjustedPace,
      baselineTimeSec: seg.targetTimeSec,
      adjustedTimeSec: adjustedTime,
      cumulativeAdjustedElapsedSec: cumAdjustedElapsed,
    };
  });
}

export function aggregateAdjustedMileSplits(
  baselineSegments: SegmentResult[],
  adjustedSegments: AdjustedSegment[],
  baselineSplits: MileSplit[]
): AdjustedMileSplit[] {
  if (baselineSegments.length === 0 || baselineSplits.length === 0) return [];

  const lastSeg = baselineSegments[baselineSegments.length - 1]!;
  const totalDistance = lastSeg.endDistance;

  return baselineSplits.map((baseline) => {
    const mileEndDist = baseline.mile * METERS_PER_MILE;
    let adjElapsed = 0;

    for (let i = 0; i < baselineSegments.length; i++) {
      const seg = baselineSegments[i]!;
      const adj = adjustedSegments[i]!;

      if (seg.endDistance <= mileEndDist) {
        adjElapsed = adj.cumulativeAdjustedElapsedSec;
      } else if (seg.startDistance < mileEndDist) {
        const fraction = (mileEndDist - seg.startDistance) / seg.distance;
        adjElapsed =
          adj.cumulativeAdjustedElapsedSec -
          adj.adjustedTimeSec +
          fraction * adj.adjustedTimeSec;
        break;
      } else {
        break;
      }
    }

    // If mile marker is past course end, use final adjusted time
    if (mileEndDist >= totalDistance) {
      const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
      adjElapsed = lastAdj.cumulativeAdjustedElapsedSec;
    }

    // Compute adjusted pace for this mile
    let prevAdjElapsed = 0;
    if (baseline.mile > 1) {
      const prevMileEndDist = (baseline.mile - 1) * METERS_PER_MILE;
      for (let i = 0; i < baselineSegments.length; i++) {
        const seg = baselineSegments[i]!;
        const adj = adjustedSegments[i]!;
        if (seg.endDistance <= prevMileEndDist) {
          prevAdjElapsed = adj.cumulativeAdjustedElapsedSec;
        } else if (seg.startDistance < prevMileEndDist) {
          const fraction = (prevMileEndDist - seg.startDistance) / seg.distance;
          prevAdjElapsed =
            adj.cumulativeAdjustedElapsedSec -
            adj.adjustedTimeSec +
            fraction * adj.adjustedTimeSec;
          break;
        } else {
          break;
        }
      }
    }

    const adjMileTime = adjElapsed - prevAdjElapsed;

    let mileDist = METERS_PER_MILE;
    const totalMiles = Math.ceil(totalDistance / METERS_PER_MILE);
    if (
      baseline.mile === totalMiles &&
      totalDistance < baseline.mile * METERS_PER_MILE
    ) {
      mileDist = totalDistance - (baseline.mile - 1) * METERS_PER_MILE;
    }

    const adjPaceSecPerMile =
      mileDist > 0 ? (adjMileTime / mileDist) * METERS_PER_MILE : 0;

    return {
      mile: baseline.mile,
      baselinePaceSecPerMile: baseline.paceSecPerMile,
      adjustedPaceSecPerMile: adjPaceSecPerMile,
      baselineElapsedSec: baseline.elapsedSec,
      adjustedElapsedSec: adjElapsed,
    };
  });
}
