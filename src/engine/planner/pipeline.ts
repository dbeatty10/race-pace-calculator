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
import { aggregateSplits } from "./aggregateMiles";
import { resolveSplitPoints } from "./splitSchedules";
import { computeSummary } from "./summary";
import { detectClimbs } from "./climbDetection";
import { paceSecPerMileToSpeedMps } from "@engine/utils/units";
import { resolveSlowdownConfig, type SlowdownResult } from "@engine/slowdown/types";
import { applySlowdown, aggregateAdjustedMileSplits } from "@engine/slowdown/applySlowdown";
import { compensateToTarget } from "@engine/slowdown/compensate";

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
  const totalDistanceM = microsegments[microsegments.length - 1]!.endDistance;
  const splitPoints = resolveSplitPoints(
    input.splitMode ?? "mile",
    totalDistanceM,
    input.customSplitDistancesM
  );

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
  let mileSplits = aggregateSplits(segmentResults, splitPoints);

  // 8. Detect climbs
  const climbs = detectClimbs(microsegments);

  // Apply slowdown if configured
  let slowdownResult: SlowdownResult | undefined;

  if (input.slowdownPreset && input.slowdownPreset !== "none") {
    const sdMode = input.slowdownMode ?? "forecast";
    const sdConfig = resolveSlowdownConfig(
      input.slowdownPreset,
      sdMode,
      {
        onsetDistanceMeters: input.slowdownOnsetMeters,
        rampDistanceMeters: input.slowdownRampMeters,
        plateauSlowdownFraction: input.slowdownPlateauFraction,
      }
    );

    const courseLengthMeters = microsegments[microsegments.length - 1]!.endDistance;
    if (sdConfig.onsetDistanceMeters > courseLengthMeters) {
      warnings.push(
        `Slowdown onset (${(sdConfig.onsetDistanceMeters / 1000).toFixed(1)} km) is beyond course length (${(courseLengthMeters / 1000).toFixed(1)} km). Slowdown will not activate.`
      );
    }

    const wallPresets = ["wall_lite", "classic_wall", "early_blowup"];
    if (wallPresets.includes(sdConfig.preset) && courseLengthMeters < 20000) {
      warnings.push(
        `The "${sdConfig.preset}" slowdown preset is designed for marathon-distance courses and may not be meaningful for a ${(courseLengthMeters / 1000).toFixed(1)} km course.`
      );
    }

    if (sdMode === "compensate_to_target" && mode !== "target_time") {
      warnings.push("Compensate-to-target slowdown mode requires target-time planning mode. Falling back to forecast mode.");
    }
    if (sdMode === "compensate_to_target" && mode === "target_time") {
      const compResult = compensateToTarget(microsegments, model, targetTimeSec, sdConfig);
      if (compResult.warning) warnings.push(compResult.warning);

      segmentResults = compResult.baselineSegments;
      mileSplits = aggregateSplits(segmentResults, splitPoints);

      const adjMileSplits = aggregateAdjustedMileSplits(segmentResults, compResult.adjustedSegments, mileSplits);

      slowdownResult = {
        config: sdConfig,
        baselineFinishTimeSec: segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec,
        adjustedFinishTimeSec: compResult.adjustedFinishTimeSec,
        slowdownCostSec: compResult.adjustedFinishTimeSec - segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec,
        adjustedSegments: compResult.adjustedSegments,
        adjustedMileSplits: adjMileSplits,
        internalTargetTimeSec: compResult.internalTargetTimeSec,
      };
    } else {
      const adjustedSegments = applySlowdown(segmentResults, sdConfig);
      const adjMileSplits = aggregateAdjustedMileSplits(segmentResults, adjustedSegments, mileSplits);
      const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
      const baselineFinish = segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec;

      slowdownResult = {
        config: sdConfig,
        baselineFinishTimeSec: baselineFinish,
        adjustedFinishTimeSec: lastAdj.cumulativeAdjustedElapsedSec,
        slowdownCostSec: lastAdj.cumulativeAdjustedElapsedSec - baselineFinish,
        adjustedSegments,
        adjustedMileSplits: adjMileSplits,
      };
    }
  }

  // 9. Compute summary
  const summary = computeSummary(
    microsegments,
    segmentResults,
    model,
    targetTimeSec,
    mode
  );

  return { summary, segments: segmentResults, mileSplits, climbs, slowdown: slowdownResult, warnings };
}
