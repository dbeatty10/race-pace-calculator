import type { SegmentResult, SplitResult } from "@engine/types";
import type {
  SlowdownScenarioConfig,
  AdjustedSegment,
  AdjustedSplitResult,
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
  baselineSplits: SplitResult[]
): AdjustedSplitResult[] {
  if (baselineSegments.length === 0 || baselineSplits.length === 0) return [];

  const lastSeg = baselineSegments[baselineSegments.length - 1]!;
  const totalDistance = lastSeg.endDistance;
  let prevDistM = 0;
  let prevAdjElapsed = 0;

  return baselineSplits.map((baseline) => {
    const targetDist = Math.min(baseline.distanceM, totalDistance);
    let adjElapsed = 0;

    for (let i = 0; i < baselineSegments.length; i++) {
      const seg = baselineSegments[i]!;
      const adj = adjustedSegments[i]!;

      if (seg.endDistance <= targetDist) {
        adjElapsed = adj.cumulativeAdjustedElapsedSec;
      } else if (seg.startDistance < targetDist) {
        const fraction = (targetDist - seg.startDistance) / seg.distance;
        adjElapsed =
          adj.cumulativeAdjustedElapsedSec -
          adj.adjustedTimeSec +
          fraction * adj.adjustedTimeSec;
        break;
      } else {
        break;
      }
    }

    const splitDistM = targetDist - prevDistM;
    const splitTime = adjElapsed - prevAdjElapsed;
    const adjPaceSecPerMile =
      splitDistM > 0 ? (splitTime / splitDistM) * METERS_PER_MILE : 0;

    const result: AdjustedSplitResult = {
      label: baseline.label,
      distanceM: targetDist,
      baselinePaceSecPerMile: baseline.paceSecPerMile,
      adjustedPaceSecPerMile: adjPaceSecPerMile,
      baselineElapsedSec: baseline.elapsedSec,
      adjustedElapsedSec: adjElapsed,
    };

    prevDistM = targetDist;
    prevAdjElapsed = adjElapsed;
    return result;
  });
}
