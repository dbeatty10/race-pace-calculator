import { describe, it, expect } from "vitest";
import {
  formatPace,
  formatElapsedTime,
  parseTargetTime,
} from "@engine/utils/paceFormatting";

describe("formatPace", () => {
  it("formats pace as m:ss /mi", () => {
    expect(formatPace(600)).toBe("10:00");
    expect(formatPace(510)).toBe("8:30");
    expect(formatPace(455)).toBe("7:35");
  });

  it("pads seconds with leading zero", () => {
    expect(formatPace(365)).toBe("6:05");
  });
});

describe("formatElapsedTime", () => {
  it("formats hours:minutes:seconds", () => {
    expect(formatElapsedTime(3600)).toBe("1:00:00");
    expect(formatElapsedTime(50400)).toBe("14:00:00");
    expect(formatElapsedTime(5430)).toBe("1:30:30");
  });

  it("formats sub-hour as m:ss", () => {
    expect(formatElapsedTime(600)).toBe("10:00");
    expect(formatElapsedTime(90)).toBe("1:30");
  });
});

describe("parseTargetTime", () => {
  it("parses HH:MM format as hours and minutes", () => {
    expect(parseTargetTime("14:00")).toBe(50400);
    expect(parseTargetTime("1:30")).toBe(5400);
  });

  it("parses H:MM:SS format", () => {
    expect(parseTargetTime("1:30:00")).toBe(5400);
    expect(parseTargetTime("14:00:00")).toBe(50400);
    expect(parseTargetTime("2:15:30")).toBe(8130);
  });

  it("parses plain number as total minutes", () => {
    expect(parseTargetTime("930")).toBe(55800);
    expect(parseTargetTime("60")).toBe(3600);
  });

  it("trims whitespace", () => {
    expect(parseTargetTime("  14:00  ")).toBe(50400);
  });

  it("throws on invalid input", () => {
    expect(() => parseTargetTime("")).toThrow();
    expect(() => parseTargetTime("abc")).toThrow();
    expect(() => parseTargetTime("1:2:3:4")).toThrow();
  });
});
