import { describe, it, expect } from "vitest";
import { rawPointsToCoursePoints, resampleToMicrosegments } from "@engine/course/resampleCourse";
import type { RawTrackPoint, CoursePoint } from "@engine/types";

describe("rawPointsToCoursePoints", () => {
  it("computes cumulative distance from raw track points", () => {
    const raw: RawTrackPoint[] = [
      { lat: 37.0, lon: -122.0, ele: 10 },
      { lat: 37.001, lon: -122.0, ele: 20 },
      { lat: 37.002, lon: -122.0, ele: 30 },
    ];
    const course = rawPointsToCoursePoints(raw);
    expect(course.length).toBe(3);
    expect(course[0]!.distance).toBe(0);
    expect(course[1]!.distance).toBeGreaterThan(100);
    expect(course[2]!.distance).toBeGreaterThan(course[1]!.distance);
    expect(course[0]!.elevation).toBe(10);
    expect(course[2]!.elevation).toBe(30);
  });
});

describe("resampleToMicrosegments", () => {
  // Create a simple 1km course climbing 100m
  const course: CoursePoint[] = [
    { distance: 0, elevation: 0 },
    { distance: 250, elevation: 25 },
    { distance: 500, elevation: 50 },
    { distance: 750, elevation: 75 },
    { distance: 1000, elevation: 100 },
  ];

  it("creates evenly spaced segments", () => {
    const segs = resampleToMicrosegments(course, 200);
    expect(segs.length).toBe(5);
    expect(segs[0]!.startDistance).toBe(0);
    expect(segs[0]!.endDistance).toBeCloseTo(200);
    expect(segs[0]!.distance).toBeCloseTo(200);
    expect(segs[4]!.endDistance).toBeCloseTo(1000);
  });

  it("computes correct grade for uniform slope", () => {
    // 100m climb over 1000m = 10% grade
    const segs = resampleToMicrosegments(course, 200);
    for (const seg of segs) {
      expect(seg.avgGradePct).toBeCloseTo(10, 0);
    }
  });

  it("handles final short segment", () => {
    const segs = resampleToMicrosegments(course, 300);
    // 1000 / 300 = 3 full + 1 short
    expect(segs.length).toBe(4);
    const last = segs[segs.length - 1]!;
    expect(last.distance).toBeCloseTo(100);
    expect(last.endDistance).toBeCloseTo(1000);
  });

  it("reports start and end elevation per segment", () => {
    const segs = resampleToMicrosegments(course, 500);
    expect(segs[0]!.startElevation).toBeCloseTo(0);
    expect(segs[0]!.endElevation).toBeCloseTo(50);
    expect(segs[1]!.startElevation).toBeCloseTo(50);
    expect(segs[1]!.endElevation).toBeCloseTo(100);
  });
});
