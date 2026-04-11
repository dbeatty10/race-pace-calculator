import { describe, it, expect } from "vitest";
import { haversineMeters } from "@engine/course/haversine";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it("computes known distance between SF and LA (~559 km)", () => {
    const d = haversineMeters(37.7749, -122.4194, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(550_000);
    expect(d).toBeLessThan(570_000);
  });

  it("computes short distance correctly (~111m for 0.001 deg lat)", () => {
    const d = haversineMeters(37.0, -122.0, 37.001, -122.0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
