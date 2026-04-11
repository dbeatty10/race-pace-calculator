import { describe, it, expect } from "vitest";
import { re3Model, re3Demand } from "@engine/models/re3";

describe("re3Demand", () => {
  it("returns a positive finite value on flat at running speed", () => {
    const d = re3Demand(3.0, 0);
    expect(d).toBeGreaterThan(0);
    expect(Number.isFinite(d)).toBe(true);
  });

  it("increases with speed at zero grade", () => {
    const d1 = re3Demand(2.0, 0);
    const d2 = re3Demand(4.0, 0);
    expect(d2).toBeGreaterThan(d1);
  });

  it("increases with uphill grade at fixed speed", () => {
    const d0 = re3Demand(3.0, 0);
    const d5 = re3Demand(3.0, 5);
    const d10 = re3Demand(3.0, 10);
    expect(d5).toBeGreaterThan(d0);
    expect(d10).toBeGreaterThan(d5);
  });
});

describe("re3Model", () => {
  const hillSpeed = re3Model.hillSpeedFromFlatSpeed!;

  it("has correct metadata", () => {
    expect(re3Model.id).toBe("re3");
    expect(re3Model.kind).toBe("demand_model");
    expect(re3Model.provenance).toBe("reconstructed");
    expect(re3Model.warning).toBeDefined();
  });

  it("returns flat speed on flat grade", () => {
    const vh = hillSpeed(3.0, 0);
    expect(vh).toBeCloseTo(3.0, 3);
  });

  it("returns slower speed on uphill", () => {
    const vh = hillSpeed(3.0, 5);
    expect(vh).toBeLessThan(3.0);
    expect(vh).toBeGreaterThan(0);
  });

  it("steeper uphill is slower", () => {
    const v5 = hillSpeed(3.0, 5);
    const v10 = hillSpeed(3.0, 10);
    expect(v10).toBeLessThan(v5);
  });

  it("preserves equal demand at solved hill speed", () => {
    const flatSpeed = 3.0;
    const gradePct = 8;
    const vh = hillSpeed(flatSpeed, gradePct);
    const demandFlat = re3Demand(flatSpeed, 0);
    const demandHill = re3Demand(vh, gradePct);
    expect(demandHill).toBeCloseTo(demandFlat, 3);
  });

  it("returns finite values across a range of grades", () => {
    for (let g = -15; g <= 30; g += 5) {
      const vh = hillSpeed(3.0, g);
      expect(Number.isFinite(vh)).toBe(true);
      expect(vh).toBeGreaterThan(0);
    }
  });
});
