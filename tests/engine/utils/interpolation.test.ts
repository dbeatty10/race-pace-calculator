import { describe, it, expect } from "vitest";
import { interp1d } from "@engine/utils/interpolation";

describe("interp1d", () => {
  const points: [number, number][] = [
    [0, 0],
    [1, 10],
    [2, 20],
    [4, 40],
  ];

  it("interpolates linearly between two points", () => {
    expect(interp1d(points, 0.5)).toBeCloseTo(5);
    expect(interp1d(points, 1.5)).toBeCloseTo(15);
    expect(interp1d(points, 3)).toBeCloseTo(30);
  });

  it("returns exact values at data points", () => {
    expect(interp1d(points, 0)).toBe(0);
    expect(interp1d(points, 1)).toBe(10);
    expect(interp1d(points, 4)).toBe(40);
  });

  it("clamps below range to first value", () => {
    expect(interp1d(points, -5)).toBe(0);
  });

  it("clamps above range to last value", () => {
    expect(interp1d(points, 10)).toBe(40);
  });

  it("handles unsorted input by sorting", () => {
    const shuffled: [number, number][] = [
      [4, 40],
      [0, 0],
      [2, 20],
      [1, 10],
    ];
    expect(interp1d(shuffled, 1.5)).toBeCloseTo(15);
  });

  it("handles two-point input", () => {
    const pair: [number, number][] = [
      [0, 1],
      [10, 2],
    ];
    expect(interp1d(pair, 5)).toBeCloseTo(1.5);
  });
});
