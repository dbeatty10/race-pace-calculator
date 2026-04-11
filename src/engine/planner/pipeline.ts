import type { PlannerInput, RacePlan } from "@engine/types";
import { parseGpx } from "@engine/course/parseGpx";
import { rawPointsToCoursePoints, resampleToMicrosegments } from "@engine/course/resampleCourse";
import { smoothElevation } from "@engine/course/smoothElevation";
import { getModel } from "@engine/models/registry";
import { solveWholeCourse } from "./solver";
import { aggregateMileSplits } from "./aggregateMiles";
import { computeSummary } from "./summary";

const DEFAULT_SEGMENT_DISTANCE = 160.934; // ~0.1 miles in meters

export function generateRacePlan(input: PlannerInput): RacePlan {
  const warnings: string[] = [];

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
  const model = getModel(input.modelId);

  // Collect model warning
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

  // 6. Solve
  const segmentResults = solveWholeCourse(
    microsegments,
    model,
    input.targetFinishTimeSec
  );

  // 7. Aggregate mile splits
  const mileSplits = aggregateMileSplits(segmentResults);

  // 8. Compute summary
  const summary = computeSummary(
    microsegments,
    segmentResults,
    model,
    input.targetFinishTimeSec
  );

  return { summary, segments: segmentResults, mileSplits, warnings };
}
