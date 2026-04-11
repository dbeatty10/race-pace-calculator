import { describe, it, expect } from "vitest";
import { solveWholeCourse } from "@engine/planner/solver";
import type { Microsegment, PaceModel } from "@engine/types";

// Trivial flat model: multiplier always 1.0
const flatModel: PaceModel = {
  id: "test_flat",
  label: "Test Flat",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: () => 1.0,
};

// Simple uphill model: multiplier = 1 + grade/10
const simpleUphillModel: PaceModel = {
  id: "test_uphill",
  label: "Test Uphill",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: (g) => 1 + g / 10,
};

// Simple demand model: D(v,g) = v*(1 + g/10); v_h = v_f/(1+g/10)
const simpleDemandModel: PaceModel = {
  id: "test_demand",
  label: "Test Demand",
  kind: "demand_model",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  hillSpeedFromFlatSpeed: (flatSpeed, gradePct) => {
    return flatSpeed / (1 + gradePct / 10);
  },
};

function makeSegments(
  _count: number,
  distEach: number,
  grades: number[]
): Microsegment[] {
  return grades.map((g, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 0,
    endElevation: 0,
    avgGradePct: g,
  }));
}

describe("solveWholeCourse — direct multiplier", () => {
  it("solves flat course to match target time", () => {
    const segs = makeSegments(10, 1000, Array(10).fill(0));
    const result = solveWholeCourse(segs, flatModel, 3600);

    expect(result.length).toBe(10);
    const totalTime = result.reduce((s, r) => s + r.targetTimeSec, 0);
    expect(totalTime).toBeCloseTo(3600, 1);
  });

  it("all segments have equal pace on flat course", () => {
    const segs = makeSegments(5, 1000, Array(5).fill(0));
    const result = solveWholeCourse(segs, flatModel, 1800);
    const paces = result.map((r) => r.targetPaceSecPerMeter);
    for (const p of paces) {
      expect(p).toBeCloseTo(paces[0]!, 6);
    }
  });

  it("uphill segments are slower than flat segments", () => {
    const segs = makeSegments(2, 1000, [0, 10]);
    const result = solveWholeCourse(segs, simpleUphillModel, 1000);
    expect(result[1]!.targetPaceSecPerMeter).toBeGreaterThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("cumulative elapsed increases monotonically", () => {
    const segs = makeSegments(5, 1000, [0, 5, -3, 8, 2]);
    const result = solveWholeCourse(segs, simpleUphillModel, 3000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.cumulativeElapsedSec).toBeGreaterThan(
        result[i - 1]!.cumulativeElapsedSec
      );
    }
  });

  it("total time matches target within tolerance", () => {
    const segs = makeSegments(5, 1000, [0, 5, -3, 8, 2]);
    const result = solveWholeCourse(segs, simpleUphillModel, 3000);
    const total = result[result.length - 1]!.cumulativeElapsedSec;
    expect(total).toBeCloseTo(3000, 1);
  });
});

describe("solveWholeCourse — demand model", () => {
  it("solves flat course to match target time", () => {
    const segs = makeSegments(5, 1000, Array(5).fill(0));
    const result = solveWholeCourse(segs, simpleDemandModel, 2500);
    const totalTime = result.reduce((s, r) => s + r.targetTimeSec, 0);
    expect(totalTime).toBeCloseTo(2500, 0);
  });

  it("uphill segments are slower", () => {
    const segs = makeSegments(3, 1000, [0, 5, 10]);
    const result = solveWholeCourse(segs, simpleDemandModel, 2000);
    expect(result[1]!.targetTimeSec).toBeGreaterThan(result[0]!.targetTimeSec);
    expect(result[2]!.targetTimeSec).toBeGreaterThan(result[1]!.targetTimeSec);
  });

  it("total time matches target within tolerance", () => {
    const segs = makeSegments(4, 1000, [0, 5, -2, 8]);
    const result = solveWholeCourse(segs, simpleDemandModel, 2000);
    const total = result[result.length - 1]!.cumulativeElapsedSec;
    expect(total).toBeCloseTo(2000, 0);
  });
});
