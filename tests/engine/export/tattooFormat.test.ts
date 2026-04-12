import { describe, it, expect } from "vitest";
import { racePlanToTattoo } from "@engine/export/tattooFormat";
import type { MileSplit } from "@engine/types";

describe("racePlanToTattoo", () => {
  const splits: MileSplit[] = [
    { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
    { mile: 2, paceSecPerMile: 750, elapsedSec: 1470 },
    { mile: 3, paceSecPerMile: 690, elapsedSec: 2160 },
  ];

  it("produces one compact line per mile", () => {
    const output = racePlanToTattoo(splits);
    const lines = output.split("\n");
    expect(lines).toHaveLength(3);
  });

  it("contains mile number, pace, and elapsed time", () => {
    const output = racePlanToTattoo(splits);
    const lines = output.split("\n");
    expect(lines[0]).toContain("1");
    expect(lines[0]).toContain("12:00");
  });

  it("uses fixed-width formatting for readability", () => {
    const longSplits: MileSplit[] = [
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 10, paceSecPerMile: 720, elapsedSec: 7200 },
    ];
    const output = racePlanToTattoo(longSplits);
    const lines = output.split("\n");
    // Both lines should have the same structure/alignment
    expect(lines[0]!.indexOf("12:00")).toBe(lines[1]!.indexOf("12:00"));
  });
});
