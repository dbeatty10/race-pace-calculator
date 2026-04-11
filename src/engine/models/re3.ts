import type { PaceModel } from "@engine/types";
import { bisect } from "@engine/utils/bisect";

/**
 * Reconstructed RE3 metabolic demand equation.
 * Mdot = 4.43 + 1.51*S + 0.37*S^2 + 30.43*S*G*(1 - 1.133 / (1 - 1.056^(100*G + 43)))
 *
 * S = speed in m/s
 * G = decimal grade (gradePct / 100)
 */
export function re3Demand(speedMps: number, gradePct: number): number {
  const G = gradePct / 100;
  const S = speedMps;

  return (
    4.43 +
    1.51 * S +
    0.37 * S * S +
    30.43 * S * G * (1 - 1.133 / (1 - Math.pow(1.056, 100 * G + 43)))
  );
}

function re3HillSpeedFromFlatSpeed(flatSpeedMps: number, gradePct: number): number {
  if (Math.abs(gradePct) < 0.001) return flatSpeedMps;

  const target = re3Demand(flatSpeedMps, 0);

  return bisect(
    (vh) => re3Demand(vh, gradePct) - target,
    0.1,
    15
  );
}

export const re3Model: PaceModel = {
  id: "re3",
  label: "Updated RE3 (reconstructed)",
  kind: "demand_model",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 35,
  supportsDownhill: true,
  notes:
    "Promising modern metabolic model intended to improve both uphill and downhill handling.",
  warning:
    "This implementation is reconstructed from OCR/PDF text and may not be character-perfect versus the typeset manuscript.",
  hillSpeedFromFlatSpeed: re3HillSpeedFromFlatSpeed,
};
