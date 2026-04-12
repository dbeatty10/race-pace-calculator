import type { SlowdownPreset, SlowdownMode, SlowdownResult } from "@engine/slowdown/types";
export type { SlowdownPreset, SlowdownMode, SlowdownResult };

// ── Course types ──

export interface RawTrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface CoursePoint {
  /** Cumulative distance from start in meters */
  distance: number;
  /** Elevation in meters */
  elevation: number;
}

export interface Microsegment {
  startDistance: number;
  endDistance: number;
  distance: number;
  startElevation: number;
  endElevation: number;
  avgGradePct: number;
}

// ── Model types ──

export type ModelKind =
  | "direct_multiplier"
  | "demand_model"
  | "interpolation_model"
  | "proprietary_unavailable";

export type Provenance =
  | "official"
  | "paper"
  | "source-code"
  | "user-inferred"
  | "reconstructed"
  | "proprietary";

export interface PaceModelContext {
  refFlatSpeedMps?: number;
}

export interface PaceModel {
  id: string;
  label: string;
  kind: ModelKind;
  provenance: Provenance;
  gradePctMin: number;
  gradePctMax: number;
  supportsDownhill: boolean;
  notes: string;
  warning?: string;

  /**
   * For direct_multiplier and interpolation_model kinds.
   * Returns multiplier M such that hillPace = flatPace * M.
   * M(0) should be ~1.0 for normalized models.
   */
  multiplier?: (gradePct: number, ctx?: PaceModelContext) => number;

  /**
   * For demand_model kinds.
   * Given a flat-equivalent speed (m/s) and grade (%),
   * returns the hill speed (m/s) that produces equal effort.
   */
  hillSpeedFromFlatSpeed?: (
    flatSpeedMps: number,
    gradePct: number,
    ctx?: PaceModelContext
  ) => number;
}

// ── Planner types ──

export interface SegmentResult {
  segmentId: number;
  startDistance: number;
  endDistance: number;
  distance: number;
  avgGradePct: number;
  modelValue: number;
  targetPaceSecPerMeter: number;
  targetTimeSec: number;
  cumulativeElapsedSec: number;
}

export interface MileSplit {
  mile: number;
  paceSecPerMile: number;
  elapsedSec: number;
}

export interface ClimbSegment {
  startDistance: number;
  endDistance: number;
  distance: number;
  elevationChange: number;
  avgGradePct: number;
  type: "climb" | "descent";
}

export interface PlanSummary {
  planningMode: PlanningMode;
  modelId: string;
  modelLabel: string;
  targetFinishTimeSec: number;
  computedFinishTimeSec: number;
  courseLengthMeters: number;
  totalClimbMeters: number;
  totalDescentMeters: number;
  flatEquivalentPaceSecPerMile: number;
  weightedDistanceMeters: number;
}

export interface RacePlan {
  summary: PlanSummary;
  segments: SegmentResult[];
  mileSplits: MileSplit[];
  climbs: ClimbSegment[];
  slowdown?: SlowdownResult;
  warnings: string[];
}

// ── Pipeline input ──

export type SmoothingLevel = "none" | "light" | "medium" | "heavy";

export type PlanningMode = "target_time" | "target_effort";

export interface PlannerInput {
  gpxData: string;
  modelId: string;
  segmentDistanceMeters?: number;
  smoothing?: SmoothingLevel;
  planningMode?: PlanningMode;
  /** Required when planningMode is "target_time" (default) */
  targetFinishTimeSec?: number;
  /** Required when planningMode is "target_effort". Flat-equivalent pace in sec/mile. */
  flatEquivalentPaceSecPerMile?: number;
  /** Optional override model — used for personal calibration */
  customModel?: PaceModel;
  /** Slowdown scenario preset. If omitted, no slowdown is applied. */
  slowdownPreset?: SlowdownPreset;
  slowdownMode?: SlowdownMode;
  /** Custom slowdown parameters (when preset is "custom") */
  slowdownOnsetMeters?: number;
  slowdownRampMeters?: number;
  slowdownPlateauFraction?: number;
}
