import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";
import type { SlowdownScenarioConfig, AdjustedSegment } from "./types";
import { solveWholeCourse } from "@engine/planner/solver";
import { applySlowdown } from "./applySlowdown";
import { bisect } from "@engine/utils/bisect";

export interface CompensateResult {
  internalTargetTimeSec: number;
  baselineSegments: SegmentResult[];
  adjustedSegments: AdjustedSegment[];
  adjustedFinishTimeSec: number;
  warning?: string;
}

export function compensateToTarget(
  microsegments: Microsegment[],
  model: PaceModel,
  userTargetTimeSec: number,
  slowdownConfig: SlowdownScenarioConfig
): CompensateResult {
  const loTarget = userTargetTimeSec * 0.3;
  const hiTarget = userTargetTimeSec;

  function adjustedFinishForInternal(tInternal: number): number {
    const segs = solveWholeCourse(microsegments, model, tInternal);
    const adjusted = applySlowdown(segs, slowdownConfig);
    const last = adjusted[adjusted.length - 1]!;
    return last.cumulativeAdjustedElapsedSec;
  }

  let internalTargetTimeSec: number;
  try {
    internalTargetTimeSec = bisect(
      (t) => adjustedFinishForInternal(t) - userTargetTimeSec,
      loTarget,
      hiTarget,
      1.0,
      50
    );
  } catch {
    // Bisect failed — root not bracketed (slowdown too extreme for the search range).
    // Fall back to user target; the warning below will fire since internal === user target
    // is 0% faster, which is not < 0.8 — so add an explicit warning here instead.
    internalTargetTimeSec = userTargetTimeSec;
    // Return early with a warning — compensation could not converge
    const baselineSegs = solveWholeCourse(microsegments, model, userTargetTimeSec);
    const adjSegs = applySlowdown(baselineSegs, slowdownConfig);
    const lastAdj = adjSegs[adjSegs.length - 1]!;
    return {
      internalTargetTimeSec: userTargetTimeSec,
      baselineSegments: baselineSegs,
      adjustedSegments: adjSegs,
      adjustedFinishTimeSec: lastAdj.cumulativeAdjustedElapsedSec,
      warning: "Could not converge on a compensation target for this slowdown scenario. The slowdown may be too extreme. Showing forecast mode instead.",
    };
  }

  const baselineSegments = solveWholeCourse(microsegments, model, internalTargetTimeSec);
  const adjustedSegments = applySlowdown(baselineSegments, slowdownConfig);
  const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
  const adjustedFinishTimeSec = lastAdj.cumulativeAdjustedElapsedSec;

  let warning: string | undefined;
  if (internalTargetTimeSec < userTargetTimeSec * 0.8) {
    warning = `Compensating for this slowdown requires a very aggressive internal pace plan (${Math.round((1 - internalTargetTimeSec / userTargetTimeSec) * 100)}% faster than your target). Consider a milder slowdown scenario.`;
  }

  return {
    internalTargetTimeSec,
    baselineSegments,
    adjustedSegments,
    adjustedFinishTimeSec,
    warning,
  };
}
