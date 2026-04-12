import type { SlowdownScenarioConfig } from "./types";

export function slowdownFraction(
  cumulativeDistanceMeters: number,
  config: SlowdownScenarioConfig
): number {
  if (config.preset === "none" || config.plateauSlowdownFraction === 0) {
    return 0;
  }

  const d = cumulativeDistanceMeters;
  const dOn = config.onsetDistanceMeters;
  const dRamp = config.rampDistanceMeters;
  const sMax = config.plateauSlowdownFraction;

  if (d < dOn) return 0;
  if (dRamp === 0) return sMax;
  if (d < dOn + dRamp) return sMax * ((d - dOn) / dRamp);
  return sMax;
}
