import type { PaceModel } from "@engine/types";

function minettiCr(gradePct: number): number {
  const g = gradePct / 100;
  return (
    155.4 * g ** 5 -
    30.4 * g ** 4 -
    43.3 * g ** 3 +
    46.3 * g ** 2 +
    19.5 * g +
    3.6
  );
}

const CR_FLAT = 3.6;

function minettiMultiplier(gradePct: number): number {
  return minettiCr(gradePct) / CR_FLAT;
}

export const minettiModel: PaceModel = {
  id: "minetti",
  label: "Minetti",
  kind: "direct_multiplier",
  provenance: "paper",
  gradePctMin: -40,
  gradePctMax: 40,
  supportsDownhill: true,
  notes:
    "Classic metabolic-cost model. Tends to over-credit steep downhills for real-world racing.",
  multiplier: minettiMultiplier,
};
