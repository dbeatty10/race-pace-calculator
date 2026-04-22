import { describe, it, expect } from "vitest";
import { racePlanToTattoo } from "@engine/export/tattooFormat";
import type { SplitResult } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

describe("racePlanToTattoo", () => {
  const splits: SplitResult[] = [
    { label: "1", distanceM: METERS_PER_MILE,     paceSecPerMile: 720, elapsedSec: 720  },
    { label: "2", distanceM: 2 * METERS_PER_MILE, paceSecPerMile: 750, elapsedSec: 1470 },
    { label: "3", distanceM: 3 * METERS_PER_MILE, paceSecPerMile: 690, elapsedSec: 2160 },
  ];

  it("produces one compact line per mile", () => {
    const output = racePlanToTattoo(splits);
    const lines = output.split("\n");
    expect(lines).toHaveLength(3);
  });

  it("contains split label, pace, and elapsed time", () => {
    const output = racePlanToTattoo(splits);
    const lines = output.split("\n");
    expect(lines[0]).toContain("1");
    expect(lines[0]).toContain("12:00");
  });

  it("uses fixed-width formatting for readability", () => {
    const longSplits: SplitResult[] = [
      { label: "1",  distanceM: METERS_PER_MILE,      paceSecPerMile: 720, elapsedSec: 720  },
      { label: "10", distanceM: 10 * METERS_PER_MILE, paceSecPerMile: 720, elapsedSec: 7200 },
    ];
    const output = racePlanToTattoo(longSplits);
    const lines = output.split("\n");
    expect(lines[0]!.indexOf("12:00")).toBe(lines[1]!.indexOf("12:00"));
  });
});
