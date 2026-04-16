import type { PaceModel, PaceModelContext } from "@engine/types";

const MPS_TO_MPH = 2.2369362920544;

function coeffA(vMph: number): number {
  return (
    -0.00591634465 +
    0.00490138698 * vMph -
    0.0000905647596 * vMph * vMph
  );
}

function coeffB(vMph: number): number {
  return (
    -0.00015589027 +
    0.000197125972 * vMph -
    0.00000287665249 * vMph * vMph
  );
}

function coeffC(vMph: number): number {
  return (
    0.00000241550499 -
    0.00000138939861 * vMph +
    0.0000000192599697 * vMph * vMph
  );
}

export function thePacingProjectMultiplier(
  gradePct: number,
  ctx?: PaceModelContext
): number {
  if (ctx?.refFlatSpeedMps == null) {
    throw new Error(
      "The Pacing Project model requires refFlatSpeedMps in PaceModelContext"
    );
  }

  const vMph = ctx.refFlatSpeedMps * MPS_TO_MPH;
  const g = gradePct;

  const A = coeffA(vMph);
  const B = coeffB(vMph);
  const C = coeffC(vMph);

  return 1 + A * g + B * g * g + C * g * g * g;
}

export const thePacingProjectModel: PaceModel = {
  id: "the_pacing_project_reconstructed",
  label: "The Pacing Project (reconstructed)",
  kind: "direct_multiplier",
  provenance: "reconstructed",
  speedDependent: true,
  gradePctMin: -26,
  gradePctMax: 26,
  supportsDownhill: true,
  notes:
    "Speed-dependent direct multiplier surface. Requires refFlatSpeedMps in context and uses an outer solve over flat-equivalent speed for whole-course planning.",
  warning:
    "This is a reconstructed approximation of The Pacing Project behavior fitted from observed calculator outputs. It is not the official The Pacing Project production formula or source code.",
  multiplier: thePacingProjectMultiplier,
};
