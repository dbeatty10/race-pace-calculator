import { describe, it, expect } from "vitest";
import { smoothElevation } from "@engine/course/smoothElevation";
import type { CoursePoint } from "@engine/types";

function makeCourse(elevations: number[], spacing: number): CoursePoint[] {
  return elevations.map((ele, i) => ({ distance: i * spacing, elevation: ele }));
}

describe("smoothElevation", () => {
  it("returns identical points for 'none' smoothing", () => {
    const course = makeCourse([10, 20, 30, 20, 10], 100);
    const result = smoothElevation(course, "none");
    expect(result).toEqual(course);
  });

  it("smooths a spike for 'light' smoothing", () => {
    const course = makeCourse([10, 10, 50, 10, 10], 100);
    const result = smoothElevation(course, "light");
    // The spike at index 2 should be reduced
    expect(result[2]!.elevation).toBeLessThan(50);
    expect(result[2]!.elevation).toBeGreaterThan(10);
  });

  it("preserves first and last elevation", () => {
    const course = makeCourse([10, 50, 10, 50, 10], 100);
    const result = smoothElevation(course, "medium");
    expect(result[0]!.elevation).toBe(10);
    expect(result[result.length - 1]!.elevation).toBe(10);
  });

  it("preserves distances", () => {
    const course = makeCourse([10, 20, 30], 100);
    const result = smoothElevation(course, "heavy");
    expect(result.map((p) => p.distance)).toEqual([0, 100, 200]);
  });

  it("does not modify original array", () => {
    const course = makeCourse([10, 50, 10], 100);
    const originalEle = course[1]!.elevation;
    smoothElevation(course, "light");
    expect(course[1]!.elevation).toBe(originalEle);
  });
});
