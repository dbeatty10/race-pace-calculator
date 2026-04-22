import { describe, it, expect } from "vitest";
import {
  isMarathonDistance,
  mileSplitPoints,
  every5kSplitPoints,
  resolveSplitPoints,
  MARATHON_5K_SPLITS,
} from "@engine/planner/splitSchedules";
import { METERS_PER_MILE } from "@engine/utils/units";

describe("isMarathonDistance", () => {
  it("returns true at exact marathon distance (42195 m)", () => {
    expect(isMarathonDistance(42195)).toBe(true);
  });

  it("returns true at lower tolerance boundary", () => {
    expect(isMarathonDistance(42195 - 0.5 * METERS_PER_MILE)).toBe(true);
  });

  it("returns true at upper tolerance boundary", () => {
    expect(isMarathonDistance(42195 + 0.5 * METERS_PER_MILE)).toBe(true);
  });

  it("returns false for half marathon distance", () => {
    expect(isMarathonDistance(21097.5)).toBe(false);
  });

  it("returns false for 50K", () => {
    expect(isMarathonDistance(50000)).toBe(false);
  });
});

describe("MARATHON_5K_SPLITS", () => {
  it("has exactly 16 entries", () => {
    expect(MARATHON_5K_SPLITS).toHaveLength(16);
  });

  it("first split is 5K at 5000 m", () => {
    expect(MARATHON_5K_SPLITS[0]!.label).toBe("5K");
    expect(MARATHON_5K_SPLITS[0]!.distanceM).toBe(5000);
  });

  it("contains HALF at ~21097.5 m", () => {
    const half = MARATHON_5K_SPLITS.find((s) => s.label === "HALF");
    expect(half).toBeDefined();
    expect(half!.distanceM).toBeCloseTo(21097.5, 0);
  });

  it("last split is 26.2 mi", () => {
    const last = MARATHON_5K_SPLITS[MARATHON_5K_SPLITS.length - 1]!;
    expect(last.label).toBe("26.2 mi");
    expect(last.distanceM).toBeCloseTo(26.2 * METERS_PER_MILE, 0);
  });

  it("is sorted ascending by distanceM", () => {
    for (let i = 1; i < MARATHON_5K_SPLITS.length; i++) {
      expect(MARATHON_5K_SPLITS[i]!.distanceM).toBeGreaterThan(
        MARATHON_5K_SPLITS[i - 1]!.distanceM
      );
    }
  });
});

describe("mileSplitPoints", () => {
  it("returns 5 points for an exact 5-mile course", () => {
    const pts = mileSplitPoints(5 * METERS_PER_MILE);
    expect(pts).toHaveLength(5);
  });

  it("labels are string mile numbers '1' through '5'", () => {
    const pts = mileSplitPoints(5 * METERS_PER_MILE);
    expect(pts.map((p) => p.label)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("returns 6 points for a 5.5-mile course", () => {
    const pts = mileSplitPoints(5.5 * METERS_PER_MILE);
    expect(pts).toHaveLength(6);
  });

  it("last point distanceM is capped at totalDistanceM for partial mile", () => {
    const total = 5.5 * METERS_PER_MILE;
    const pts = mileSplitPoints(total);
    expect(pts[pts.length - 1]!.distanceM).toBeCloseTo(total, 3);
  });

  it("full mile points have distanceM = mile * METERS_PER_MILE", () => {
    const pts = mileSplitPoints(5 * METERS_PER_MILE);
    for (let i = 0; i < pts.length; i++) {
      expect(pts[i]!.distanceM).toBeCloseTo((i + 1) * METERS_PER_MILE, 3);
    }
  });
});

describe("every5kSplitPoints", () => {
  it("returns 2 points for a 10K course", () => {
    const pts = every5kSplitPoints(10000);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.label).toBe("5K");
    expect(pts[0]!.distanceM).toBe(5000);
    expect(pts[1]!.label).toBe("10K");
    expect(pts[1]!.distanceM).toBe(10000);
  });

  it("partial last segment is labeled Finish for a 12K course", () => {
    const pts = every5kSplitPoints(12000);
    expect(pts).toHaveLength(3);
    expect(pts[2]!.distanceM).toBeCloseTo(12000, 3);
    expect(pts[2]!.label).toBe("Finish");
  });
});

describe("resolveSplitPoints", () => {
  it("mode 'mile' returns mileSplitPoints result", () => {
    const pts = resolveSplitPoints("mile", 5 * METERS_PER_MILE);
    expect(pts).toHaveLength(5);
    expect(pts[0]!.label).toBe("1");
  });

  it("mode '5k' on marathon-distance course returns MARATHON_5K_SPLITS", () => {
    const pts = resolveSplitPoints("5k", 42195);
    expect(pts).toHaveLength(16);
    expect(pts[0]!.label).toBe("5K");
  });

  it("mode '5k' on non-marathon course returns every5kSplitPoints", () => {
    const pts = resolveSplitPoints("5k", 10000);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.label).toBe("5K");
  });

  it("mode 'custom_miles' creates splits with mile labels from meter distances", () => {
    const pts = resolveSplitPoints("custom_miles", 50000, [
      13.1 * METERS_PER_MILE,
      26.2 * METERS_PER_MILE,
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.distanceM).toBeCloseTo(13.1 * METERS_PER_MILE, 0);
    expect(pts[0]!.label).toBe("13.1 mi");
  });

  it("mode 'custom_km' creates splits with km labels from meter distances", () => {
    const pts = resolveSplitPoints("custom_km", 50000, [21100, 42200]);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.distanceM).toBeCloseTo(21100, 0);
    expect(pts[0]!.label).toBe("21.1 km");
  });

  it("falls back to mileSplitPoints when custom mode has no distances", () => {
    const pts = resolveSplitPoints("custom_miles", 5 * METERS_PER_MILE);
    expect(pts).toHaveLength(5);
    expect(pts[0]!.label).toBe("1");
  });
});
