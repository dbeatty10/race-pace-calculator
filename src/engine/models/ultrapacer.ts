import type { PaceModel } from "@engine/types";

export function ultrapacerDefaultMultiplier(gradePct: number): number {
  let f: number;

  if (gradePct < -22) {
    f = -0.0584 * gradePct - 0.0164;
  } else if (gradePct > 16) {
    f = 0.1012 * gradePct - 0.4624;
  } else {
    f = 0.0021 * gradePct * gradePct + 0.034 * gradePct;
  }

  return 1 + f;
}

export const ultrapacerModel: PaceModel = {
  id: "ultrapacer_default",
  label: "Ultrapacer default grade model",
  kind: "direct_multiplier",
  provenance: "source-code",
  gradePctMin: -45,
  gradePctMax: 45,
  supportsDownhill: true,
  notes:
    "Piecewise quadratic/linear grade-to-multiplier heuristic from ultrapacer core defaults.",
  multiplier: ultrapacerDefaultMultiplier,
};
