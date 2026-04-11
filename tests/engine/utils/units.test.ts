import { describe, it, expect } from "vitest";
import {
  speedMpsToPaceSecPerMile,
  paceSecPerMileToSpeedMps,
  speedMpsToPaceSecPerKm,
  paceSecPerKmToSpeedMps,
  metersToMiles,
  milesToMeters,
  metersToFeet,
} from "@engine/utils/units";

describe("speed/pace conversions", () => {
  it("converts speed m/s to pace sec/mile", () => {
    // 1609.344m / 2.68224 m/s = 600 sec = 10:00/mi
    expect(speedMpsToPaceSecPerMile(2.68224)).toBeCloseTo(600, 0);
  });

  it("converts pace sec/mile to speed m/s", () => {
    expect(paceSecPerMileToSpeedMps(600)).toBeCloseTo(2.68224, 3);
  });

  it("round-trips speed through pace/mile", () => {
    const speed = 3.5;
    expect(paceSecPerMileToSpeedMps(speedMpsToPaceSecPerMile(speed))).toBeCloseTo(speed, 6);
  });

  it("converts speed m/s to pace sec/km", () => {
    // 1000m / 4 m/s = 250 sec
    expect(speedMpsToPaceSecPerKm(4)).toBeCloseTo(250);
  });

  it("converts pace sec/km to speed m/s", () => {
    expect(paceSecPerKmToSpeedMps(250)).toBeCloseTo(4);
  });
});

describe("distance conversions", () => {
  it("converts meters to miles", () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1, 5);
  });

  it("converts miles to meters", () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344, 2);
  });

  it("converts meters to feet", () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 3);
  });
});
