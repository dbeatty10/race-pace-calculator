export type SlowdownMode = "forecast" | "compensate_to_target";

export type SlowdownPreset =
  | "none"
  | "controlled_late_fade"
  | "gentle_late_fade"
  | "moderate_late_fade"
  | "wall_lite"
  | "classic_wall"
  | "early_blowup"
  | "custom";

export interface SlowdownScenarioConfig {
  preset: SlowdownPreset;
  mode: SlowdownMode;
  onsetDistanceMeters: number;
  rampDistanceMeters: number;
  plateauSlowdownFraction: number;
}

export interface AdjustedSegment {
  segmentId: number;
  slowdownFraction: number;
  baselinePaceSecPerMeter: number;
  adjustedPaceSecPerMeter: number;
  baselineTimeSec: number;
  adjustedTimeSec: number;
  cumulativeAdjustedElapsedSec: number;
}

export interface AdjustedMileSplit {
  mile: number;
  baselinePaceSecPerMile: number;
  adjustedPaceSecPerMile: number;
  baselineElapsedSec: number;
  adjustedElapsedSec: number;
}

export interface SlowdownResult {
  config: SlowdownScenarioConfig;
  baselineFinishTimeSec: number;
  adjustedFinishTimeSec: number;
  slowdownCostSec: number;
  adjustedSegments: AdjustedSegment[];
  adjustedMileSplits: AdjustedMileSplit[];
  /** Only present in compensate_to_target mode */
  internalTargetTimeSec?: number;
}

export const SLOWDOWN_PRESET_CONFIGS: Record<
  Exclude<SlowdownPreset, "none" | "custom">,
  Omit<SlowdownScenarioConfig, "preset" | "mode">
> = {
  controlled_late_fade: {
    onsetDistanceMeters: 37000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.02,
  },
  gentle_late_fade: {
    onsetDistanceMeters: 32000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.05,
  },
  moderate_late_fade: {
    onsetDistanceMeters: 31000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.1,
  },
  wall_lite: {
    onsetDistanceMeters: 31000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.2,
  },
  classic_wall: {
    onsetDistanceMeters: 30000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.3,
  },
  early_blowup: {
    onsetDistanceMeters: 27000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.25,
  },
};

export const SLOWDOWN_PRESET_LABELS: Record<SlowdownPreset, string> = {
  none: "No slowdown",
  controlled_late_fade: "Controlled / tiny late fade",
  gentle_late_fade: "Gentle late fade",
  moderate_late_fade: "Moderate late fade",
  wall_lite: "Wall-lite",
  classic_wall: "Classic wall",
  early_blowup: "Early blow-up",
  custom: "Custom",
};

export function resolveSlowdownConfig(
  preset: SlowdownPreset,
  mode: SlowdownMode,
  custom?: Partial<Pick<SlowdownScenarioConfig, "onsetDistanceMeters" | "rampDistanceMeters" | "plateauSlowdownFraction">>
): SlowdownScenarioConfig {
  if (preset === "none") {
    return {
      preset,
      mode,
      onsetDistanceMeters: 0,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0,
    };
  }

  if (preset === "custom") {
    return {
      preset,
      mode,
      onsetDistanceMeters: custom?.onsetDistanceMeters ?? 30000,
      rampDistanceMeters: custom?.rampDistanceMeters ?? 3000,
      plateauSlowdownFraction: custom?.plateauSlowdownFraction ?? 0.1,
    };
  }

  const base = SLOWDOWN_PRESET_CONFIGS[preset];
  return { preset, mode, ...base };
}
