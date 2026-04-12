import type { PlannerInput, RacePlan } from "@engine/types";
import { parseGpx } from "@engine/course/parseGpx";
import {
  rawPointsToCoursePoints,
  resampleToMicrosegments,
} from "@engine/course/resampleCourse";
import { smoothElevation } from "@engine/course/smoothElevation";
import { getModel } from "@engine/models/registry";
import { solveWholeCourse } from "./solver";
import { propagateEffort } from "./targetEffort";
import { aggregateMileSplits } from "./aggregateMiles";
import { computeSummary } from "./summary";
import { detectClimbs } from "./climbDetection";
import { paceSecPerMileToSpeedMps } from "@engine/utils/units";

const DEFAULT_SEGMENT_DISTANCE = 160.934; // ~0.1 miles in meters

export function generateRacePlan(input: PlannerInput): RacePlan {
  const warnings: string[] = [];
  const mode = input.planningMode ?? "target_time";

  // Validate mode-specific inputs
  if (mode === "target_time" && input.targetFinishTimeSec == null) {
    throw new Error("targetFinishTimeSec is required for target_time mode");
  }
  if (mode === "target_effort" && input.flatEquivalentPaceSecPerMile == null) {
    throw new Error(
      "flatEquivalentPaceSecPerMile is required for target_effort mode"
    );
  }

  // 1. Parse GPX
  const rawPoints = parseGpx(input.gpxData);

  // 2. Convert to course points with cumulative distance
  const coursePoints = rawPointsToCoursePoints(rawPoints);

  // 3. Smooth elevation
  const smoothed = smoothElevation(coursePoints, input.smoothing ?? "light");

  // 4. Resample to microsegments
  const segmentDist = input.segmentDistanceMeters ?? DEFAULT_SEGMENT_DISTANCE;
  const microsegments = resampleToMicrosegments(smoothed, segmentDist);

  // 5. Get model
  const model = input.customModel ?? getModel(input.modelId);

  if (model.warning) {
    warnings.push(model.warning);
  }

  // Check grade range warnings
  const grades = microsegments.map((s) => s.avgGradePct);
  const minGrade = Math.min(...grades);
  const maxGrade = Math.max(...grades);
  if (minGrade < model.gradePctMin || maxGrade > model.gradePctMax) {
    warnings.push(
      `Course grades (${minGrade.toFixed(1)}% to ${maxGrade.toFixed(1)}%) exceed model's recommended range (${model.gradePctMin}% to ${model.gradePctMax}%).`
    );
  }

  // 6. Solve based on planning mode
  let segmentResults;
  let targetTimeSec: number;

  if (mode === "target_effort") {
    const flatSpeedMps = paceSecPerMileToSpeedMps(
      input.flatEquivalentPaceSecPerMile!
    );
    segmentResults = propagateEffort(microsegments, model, flatSpeedMps);
    // In target effort mode, the "target" is the computed projection
    targetTimeSec =
      segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec;
  } else {
    targetTimeSec = input.targetFinishTimeSec!;
    segmentResults = solveWholeCourse(microsegments, model, targetTimeSec);
  }

  // 7. Aggregate mile splits
  const mileSplits = aggregateMileSplits(segmentResults);

  // 8. Detect climbs
  const climbs = detectClimbs(microsegments);

  // 9. Compute summary
  const summary = computeSummary(
    microsegments,
    segmentResults,
    model,
    targetTimeSec,
    mode
  );

  return { summary, segments: segmentResults, mileSplits, climbs, warnings };
}
