import { describe, it, expect } from "vitest";
import { detectClimbs } from "@engine/planner/climbDetection";
import type { Microsegment } from "@engine/types";

function makeSegments(
  specs: { grade: number; dist: number; startDist: number; startEle: number }[]
): Microsegment[] {
  return specs.map((s) => {
    const elevChange = (s.grade / 100) * s.dist;
    return {
      startDistance: s.startDist,
      endDistance: s.startDist + s.dist,
      distance: s.dist,
      startElevation: s.startEle,
      endElevation: s.startEle + elevChange,
      avgGradePct: s.grade,
    };
  });
}

describe("detectClimbs", () => {
  it("returns empty for flat course", () => {
    const segs = makeSegments([
      { grade: 0, dist: 1000, startDist: 0, startEle: 100 },
      { grade: 0.5, dist: 1000, startDist: 1000, startEle: 100 },
      { grade: -0.5, dist: 1000, startDist: 2000, startEle: 105 },
    ]);
    const climbs = detectClimbs(segs);
    expect(climbs).toHaveLength(0);
  });

  it("detects a single significant climb", () => {
    // 10 segments of 5% uphill, 200m each = 2000m distance, 100m gain
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      const startDist = i * 200;
      const startEle = 100 + i * 10;
      segs.push({
        startDistance: startDist,
        endDistance: startDist + 200,
        distance: 200,
        startElevation: startEle,
        endElevation: startEle + 10,
        avgGradePct: 5,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs.length).toBeGreaterThanOrEqual(1);
    const climb = climbs.find((c) => c.type === "climb");
    expect(climb).toBeDefined();
    expect(climb!.elevationChange).toBeCloseTo(100, 0);
  });

  it("detects a significant descent", () => {
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      const startDist = i * 200;
      const startEle = 200 - i * 10;
      segs.push({
        startDistance: startDist,
        endDistance: startDist + 200,
        distance: 200,
        startElevation: startEle,
        endElevation: startEle - 10,
        avgGradePct: -5,
      });
    }
    const climbs = detectClimbs(segs);
    const descent = climbs.find((c) => c.type === "descent");
    expect(descent).toBeDefined();
    expect(descent!.elevationChange).toBeCloseTo(100, 0);
  });

  it("ignores small elevation changes below threshold", () => {
    // 5 segments of 3% uphill, 100m each = 500m distance, 15m gain (below default 30m threshold)
    const segs: Microsegment[] = [];
    for (let i = 0; i < 5; i++) {
      segs.push({
        startDistance: i * 100,
        endDistance: (i + 1) * 100,
        distance: 100,
        startElevation: 100 + i * 3,
        endElevation: 100 + (i + 1) * 3,
        avgGradePct: 3,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs).toHaveLength(0);
  });

  it("detects climb then descent as separate entries", () => {
    const segs: Microsegment[] = [];
    // 10 uphill segments: 5%, 200m each = 100m gain
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: i * 200,
        endDistance: (i + 1) * 200,
        distance: 200,
        startElevation: 100 + i * 10,
        endElevation: 110 + i * 10,
        avgGradePct: 5,
      });
    }
    // 10 downhill segments: -5%, 200m each = 100m loss
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: 2000 + i * 200,
        endDistance: 2000 + (i + 1) * 200,
        distance: 200,
        startElevation: 200 - i * 10,
        endElevation: 190 - i * 10,
        avgGradePct: -5,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs.length).toBe(2);
    expect(climbs[0]!.type).toBe("climb");
    expect(climbs[1]!.type).toBe("descent");
  });

  it("returns empty for empty input", () => {
    expect(detectClimbs([])).toHaveLength(0);
  });

  it("respects custom minGainMeters", () => {
    // 10 segments of 5% uphill, 200m each = 100m gain
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: i * 200,
        endDistance: (i + 1) * 200,
        distance: 200,
        startElevation: 100 + i * 10,
        endElevation: 110 + i * 10,
        avgGradePct: 5,
      });
    }
    // With threshold 200m, this 100m climb should be filtered out
    expect(detectClimbs(segs, { minGainMeters: 200 })).toHaveLength(0);
    // With threshold 50m, it should be detected
    expect(detectClimbs(segs, { minGainMeters: 50 }).length).toBeGreaterThanOrEqual(1);
  });
});
