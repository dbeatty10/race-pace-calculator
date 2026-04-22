import type { SplitPoint, SplitIntervalMode } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

const MARATHON_DISTANCE_M = 42195;
const MARATHON_TOLERANCE_M = 0.5 * METERS_PER_MILE;

export const MARATHON_5K_SPLITS: SplitPoint[] = [
  { label: "5K",      distanceM: 5000 },
  { label: "10K",     distanceM: 10000 },
  { label: "15K",     distanceM: 15000 },
  { label: "20K",     distanceM: 20000 },
  { label: "HALF",    distanceM: 21097.5 },
  { label: "25K",     distanceM: 25000 },
  { label: "30K",     distanceM: 30000 },
  { label: "20 mi",   distanceM: 20 * METERS_PER_MILE },
  { label: "21 mi",   distanceM: 21 * METERS_PER_MILE },
  { label: "35K",     distanceM: 35000 },
  { label: "23 mi",   distanceM: 23 * METERS_PER_MILE },
  { label: "24 mi",   distanceM: 24 * METERS_PER_MILE },
  { label: "40K",     distanceM: 40000 },
  { label: "25.2 mi", distanceM: 25.2 * METERS_PER_MILE },
  { label: "26 mi",   distanceM: 26 * METERS_PER_MILE },
  { label: "26.2 mi", distanceM: 26.2 * METERS_PER_MILE },
];

export function isMarathonDistance(totalDistanceM: number): boolean {
  return Math.abs(totalDistanceM - MARATHON_DISTANCE_M) <= MARATHON_TOLERANCE_M;
}

export function mileSplitPoints(totalDistanceM: number): SplitPoint[] {
  const totalMiles = Math.ceil(totalDistanceM / METERS_PER_MILE);
  return Array.from({ length: totalMiles }, (_, i) => {
    const mile = i + 1;
    return {
      label: String(mile),
      distanceM: Math.min(mile * METERS_PER_MILE, totalDistanceM),
    };
  });
}

export function every5kSplitPoints(totalDistanceM: number): SplitPoint[] {
  const count = Math.ceil(totalDistanceM / 5000);
  return Array.from({ length: count }, (_, i) => {
    const targetDist = Math.min((i + 1) * 5000, totalDistanceM);
    const isPartial = targetDist < (i + 1) * 5000;
    return {
      label: isPartial ? "Finish" : `${(i + 1) * 5}K`,
      distanceM: targetDist,
    };
  });
}

export function resolveSplitPoints(
  mode: SplitIntervalMode,
  totalDistanceM: number,
  customDistancesM?: number[]
): SplitPoint[] {
  if (mode === "mile") return mileSplitPoints(totalDistanceM);

  if (mode === "5k") {
    return isMarathonDistance(totalDistanceM)
      ? MARATHON_5K_SPLITS
      : every5kSplitPoints(totalDistanceM);
  }

  if (customDistancesM && customDistancesM.length > 0) {
    return customDistancesM.map((d) => ({
      label:
        mode === "custom_miles"
          ? `${(d / METERS_PER_MILE).toFixed(1)} mi`
          : `${(d / 1000).toFixed(1)} km`,
      distanceM: d,
    }));
  }

  return mileSplitPoints(totalDistanceM);
}
