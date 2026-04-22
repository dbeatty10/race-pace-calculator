import type { SegmentResult, SplitPoint, SplitResult } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function aggregateSplits(
  segments: SegmentResult[],
  splitPoints: SplitPoint[]
): SplitResult[] {
  if (segments.length === 0 || splitPoints.length === 0) return [];

  const last = segments[segments.length - 1]!;
  const totalDistance = last.endDistance;
  const results: SplitResult[] = [];
  let prevDistM = 0;
  let prevElapsed = 0;

  for (const sp of splitPoints) {
    const targetDist = Math.min(sp.distanceM, totalDistance);
    let elapsed = 0;

    for (const seg of segments) {
      if (seg.endDistance <= targetDist) {
        elapsed = seg.cumulativeElapsedSec;
      } else if (seg.startDistance < targetDist) {
        const fraction = (targetDist - seg.startDistance) / seg.distance;
        elapsed =
          seg.cumulativeElapsedSec -
          seg.targetTimeSec +
          fraction * seg.targetTimeSec;
        break;
      } else {
        break;
      }
    }

    const splitDistM = targetDist - prevDistM;
    const splitTime = elapsed - prevElapsed;
    const paceSecPerMile =
      splitDistM > 0 ? (splitTime / splitDistM) * METERS_PER_MILE : 0;

    results.push({
      label: sp.label,
      distanceM: targetDist,
      paceSecPerMile,
      elapsedSec: elapsed,
    });

    prevDistM = targetDist;
    prevElapsed = elapsed;
  }

  return results;
}
