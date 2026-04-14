import type { PaceModel } from "@engine/types";
import { interp1d } from "@engine/utils/interpolation";

export interface CalibrationPoint {
  gradePct: number;
  multiplier: number;
}

export const PERSONAL_CALIBRATION_ID = "personal_calibration";

export function createPersonalCalibrationModel(
  points: CalibrationPoint[]
): PaceModel {
  if (points.length < 2) {
    throw new Error("Personal calibration requires at least 2 data points");
  }

  const sorted = [...points].sort((a, b) => a.gradePct - b.gradePct);
  const interpPoints: [number, number][] = sorted.map((p) => [
    p.gradePct,
    p.multiplier,
  ]);

  const minGrade = sorted[0]!.gradePct;
  const maxGrade = sorted[sorted.length - 1]!.gradePct;

  return {
    id: PERSONAL_CALIBRATION_ID,
    label: "Personal calibration",
    kind: "direct_multiplier",
    provenance: "user-inferred",
    gradePctMin: minGrade,
    gradePctMax: maxGrade,
    supportsDownhill: minGrade < 0,
    notes: `User-provided calibration with ${points.length} data points. Linear interpolation, clamped outside [${minGrade}%, ${maxGrade}%].`,
    warning:
      "Personal calibration model — values outside your calibration range are clamped to boundary values.",
    multiplier: (gradePct: number) => interp1d(interpPoints, gradePct),
  };
}

export function parseCalibrationText(text: string): CalibrationPoint[] {
  const lines = text.split("\n");
  const points: CalibrationPoint[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const parts = line.split(",");
    if (parts.length !== 2) {
      throw new Error(
        `Invalid calibration line: "${line}" — expected "gradePct, multiplier"`
      );
    }

    const gradePct = parseFloat(parts[0]!.trim());
    const multiplier = parseFloat(parts[1]!.trim());

    if (isNaN(gradePct) || isNaN(multiplier)) {
      throw new Error(`Invalid numbers in calibration line: "${line}"`);
    }

    points.push({ gradePct, multiplier });
  }

  if (points.length === 0) {
    throw new Error("No valid calibration data found");
  }

  return points;
}
