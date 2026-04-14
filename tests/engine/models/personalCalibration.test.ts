import { describe, it, expect } from "vitest";
import {
  createPersonalCalibrationModel,
  parseCalibrationText,
} from "@engine/models/personalCalibration";

describe("createPersonalCalibrationModel", () => {
  const points = [
    { gradePct: -10, multiplier: 0.85 },
    { gradePct: -5, multiplier: 0.92 },
    { gradePct: 0, multiplier: 1.0 },
    { gradePct: 5, multiplier: 1.2 },
    { gradePct: 10, multiplier: 1.5 },
    { gradePct: 15, multiplier: 2.0 },
  ];

  it("creates a valid PaceModel", () => {
    const model = createPersonalCalibrationModel(points);
    expect(model.id).toBe("personal_calibration");
    expect(model.kind).toBe("direct_multiplier");
    expect(model.multiplier).toBeDefined();
  });

  it("returns exact values at data points", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    expect(mult(0)).toBeCloseTo(1.0, 6);
    expect(mult(10)).toBeCloseTo(1.5, 6);
    expect(mult(-10)).toBeCloseTo(0.85, 6);
  });

  it("interpolates between data points", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    // Between 0 (1.0) and 5 (1.2): at 2.5, expect ~1.1
    expect(mult(2.5)).toBeCloseTo(1.1, 4);
  });

  it("clamps outside data range", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    // Below range: clamp to value at -10
    expect(mult(-20)).toBeCloseTo(0.85, 6);
    // Above range: clamp to value at 15
    expect(mult(25)).toBeCloseTo(2.0, 6);
  });

  it("sets grade range from data points", () => {
    const model = createPersonalCalibrationModel(points);
    expect(model.gradePctMin).toBe(-10);
    expect(model.gradePctMax).toBe(15);
  });

  it("throws if fewer than 2 points", () => {
    expect(() =>
      createPersonalCalibrationModel([{ gradePct: 0, multiplier: 1 }])
    ).toThrow("at least 2");
  });

  it("handles unsorted input", () => {
    const shuffled = [
      { gradePct: 10, multiplier: 1.5 },
      { gradePct: -5, multiplier: 0.92 },
      { gradePct: 0, multiplier: 1.0 },
    ];
    const model = createPersonalCalibrationModel(shuffled);
    expect(model.multiplier!(0)).toBeCloseTo(1.0, 6);
    expect(model.multiplier!(5)).toBeCloseTo(1.25, 4);
  });
});

describe("parseCalibrationText", () => {
  it("parses comma-separated lines", () => {
    const text = "-10, 0.85\n0, 1.0\n10, 1.5";
    const points = parseCalibrationText(text);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ gradePct: -10, multiplier: 0.85 });
    expect(points[2]).toEqual({ gradePct: 10, multiplier: 1.5 });
  });

  it("skips blank lines and comments", () => {
    const text = "# my calibration\n-5, 0.92\n\n0, 1.0\n# uphill\n10, 1.5";
    const points = parseCalibrationText(text);
    expect(points).toHaveLength(3);
  });

  it("throws on invalid format", () => {
    expect(() => parseCalibrationText("bad data")).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => parseCalibrationText("")).toThrow("No valid");
  });
});
