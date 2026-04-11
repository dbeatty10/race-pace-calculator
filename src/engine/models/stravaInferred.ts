import type { PaceModel } from "@engine/types";
import { interp1d } from "@engine/utils/interpolation";

/**
 * User-inferred data points digitized from publicly visible Strava GAP curves.
 * NOT the official Strava production formula.
 *
 * Format: [gradePct, multiplier]
 * Multiplier is relative to flat (1.0 = same as flat).
 */
export const STRAVA_INFERRED_POINTS: [number, number][] = [
  [-20, 1.10],
  [-18, 1.00],
  [-15, 0.92],
  [-12, 0.88],
  [-10, 0.87],
  [-8, 0.88],
  [-6, 0.90],
  [-4, 0.93],
  [-2, 0.96],
  [0, 1.00],
  [2, 1.07],
  [4, 1.15],
  [6, 1.25],
  [8, 1.37],
  [10, 1.50],
  [12, 1.68],
  [15, 2.02],
  [18, 2.42],
  [20, 2.80],
];

function stravaInferredMultiplier(gradePct: number): number {
  const minX = STRAVA_INFERRED_POINTS[0]![0];
  const maxX = STRAVA_INFERRED_POINTS[STRAVA_INFERRED_POINTS.length - 1]![0];

  if (gradePct >= minX && gradePct <= maxX) {
    return interp1d(STRAVA_INFERRED_POINTS, gradePct);
  }

  // Fallback quadratic outside data range
  return 1 + 0.029 * gradePct + 0.0015 * gradePct ** 2;
}

export const stravaInferredModel: PaceModel = {
  id: "strava_inferred",
  label: "Strava GAP (user-inferred)",
  kind: "interpolation_model",
  provenance: "user-inferred",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes:
    "User-inferred approximation from digitized public graph data. Uses fallback quadratic outside data range.",
  warning:
    "This is a user-inferred approximation from digitized public graph data, not the official Strava production formula.",
  multiplier: stravaInferredMultiplier,
};
