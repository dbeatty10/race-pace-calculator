import type { Microsegment, ClimbSegment } from "@engine/types";

const DEFAULT_FLAT_THRESHOLD_PCT = 2;
const DEFAULT_MIN_GAIN_METERS = 30;

export interface ClimbDetectionOptions {
  minGainMeters?: number;
  flatThresholdPct?: number;
}

type Direction = "climb" | "descent" | "flat";

function classify(gradePct: number, threshold: number): Direction {
  if (gradePct > threshold) return "climb";
  if (gradePct < -threshold) return "descent";
  return "flat";
}

export function detectClimbs(
  segments: Microsegment[],
  options: ClimbDetectionOptions = {}
): ClimbSegment[] {
  const minGain = options.minGainMeters ?? DEFAULT_MIN_GAIN_METERS;
  const flatThreshold = options.flatThresholdPct ?? DEFAULT_FLAT_THRESHOLD_PCT;

  if (segments.length === 0) return [];

  // Step 1: classify each segment
  const dirs: Direction[] = segments.map((s) =>
    classify(s.avgGradePct, flatThreshold)
  );

  // Step 2: merge flat segments into adjacent non-flat direction
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i] === "flat") {
      // Look backward for nearest non-flat
      for (let j = i - 1; j >= 0; j--) {
        if (dirs[j] !== "flat") {
          dirs[i] = dirs[j]!;
          break;
        }
      }
    }
  }

  // If all are still flat, no climbs
  if (dirs.every((d) => d === "flat")) return [];

  // Step 3: group consecutive same-direction segments
  const groups: { dir: Direction; startIdx: number; endIdx: number }[] = [];
  let groupStart = 0;
  for (let i = 1; i <= dirs.length; i++) {
    if (i === dirs.length || dirs[i] !== dirs[groupStart]) {
      groups.push({
        dir: dirs[groupStart]!,
        startIdx: groupStart,
        endIdx: i - 1,
      });
      groupStart = i;
    }
  }

  // Step 4: compute elevation change per group, filter by threshold
  const climbs: ClimbSegment[] = [];

  for (const group of groups) {
    if (group.dir === "flat") continue;

    const groupSegs = segments.slice(group.startIdx, group.endIdx + 1);
    const first = groupSegs[0]!;
    const last = groupSegs[groupSegs.length - 1]!;
    const startDist = first.startDistance;
    const endDist = last.endDistance;
    const dist = endDist - startDist;

    let gain = 0;
    let loss = 0;
    for (const s of groupSegs) {
      const diff = s.endElevation - s.startElevation;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    const elevationChange = group.dir === "climb" ? gain : loss;

    if (elevationChange >= minGain && dist > 0) {
      climbs.push({
        startDistance: startDist,
        endDistance: endDist,
        distance: dist,
        elevationChange,
        avgGradePct:
          group.dir === "climb"
            ? (gain / dist) * 100
            : -(loss / dist) * 100,
        type: group.dir,
      });
    }
  }

  return climbs;
}
