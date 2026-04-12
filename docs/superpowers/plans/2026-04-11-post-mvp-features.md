# Post-MVP Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add target effort mode, climb/descent detection, slowdown scenarios, two new hill models (Ultrapacer + personal calibration), and export capabilities (CSV/JSON/tattoo-friendly) to the existing race-plan calculator.

**Architecture:** Each feature is a self-contained module that plugs into the existing pipeline. New models follow the established `PaceModel` interface. Target effort mode adds a second planning path through the solver. Slowdown is a post-processing overlay on the baseline plan. Export and climb detection are pure output transforms. All engine code is pure functions with no side effects; UI is thin React components.

**Tech Stack:** TypeScript, Vite, React 19, Vitest (jsdom), path aliases `@engine/*` and `@ui/*`

**Important codebase conventions:**
- `tsconfig.json` has `noUncheckedIndexedAccess: true` — array indexing returns `T | undefined`. Use `!` non-null assertion after bounds-checked access.
- All internal distances are in **meters**. All internal times are in **seconds**. Use `METERS_PER_MILE` from `@engine/utils/units` for conversions.
- Hill models implement the `PaceModel` interface from `@engine/types`. Direct multiplier models provide `multiplier(gradePct) → number`. Demand models provide `hillSpeedFromFlatSpeed(flatSpeedMps, gradePct) → number`.
- The existing pipeline in `src/engine/planner/pipeline.ts` is: parse GPX → smooth elevation → resample to microsegments → solve → aggregate mile splits → compute summary.
- Tests live in `tests/` mirroring `src/` structure. Run with `npx vitest run`.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/engine/models/ultrapacer.ts` | Ultrapacer piecewise quadratic/linear multiplier model |
| `src/engine/models/personalCalibration.ts` | Factory that creates a `PaceModel` from user-provided `[gradePct, multiplier]` points |
| `src/engine/planner/targetEffort.ts` | `propagateEffort()` — propagate a fixed flat-equivalent speed through segments |
| `src/engine/planner/climbDetection.ts` | Detect major climbs and descents from microsegments |
| `src/engine/slowdown/types.ts` | Slowdown types, preset configs, and preset descriptions |
| `src/engine/slowdown/slowdownFunction.ts` | Core `slowdownFraction(distance, config)` piecewise function |
| `src/engine/slowdown/applySlowdown.ts` | Apply slowdown overlay to baseline segments; aggregate adjusted mile splits |
| `src/engine/slowdown/compensate.ts` | Compensate-to-target root-finding wrapper |
| `src/engine/export/csvExport.ts` | Serialize race plan to CSV string |
| `src/engine/export/tattooFormat.ts` | Compact wristband-friendly text format |
| `src/ui/components/ClimbTable.tsx` | Table of detected climbs and descents |
| `src/ui/components/SlowdownControls.tsx` | Preset dropdown, custom inputs, mode selector |
| `src/ui/components/SlowdownSplitsTable.tsx` | Baseline vs adjusted mile splits comparison table |
| `src/ui/components/ExportControls.tsx` | Download CSV / JSON / tattoo buttons |
| `tests/engine/models/ultrapacer.test.ts` | Ultrapacer model tests |
| `tests/engine/models/personalCalibration.test.ts` | Personal calibration factory tests |
| `tests/engine/planner/targetEffort.test.ts` | Target effort propagation tests |
| `tests/engine/planner/climbDetection.test.ts` | Climb detection tests |
| `tests/engine/slowdown/slowdownFunction.test.ts` | Core slowdown function tests |
| `tests/engine/slowdown/applySlowdown.test.ts` | Overlay application tests |
| `tests/engine/slowdown/compensate.test.ts` | Compensate mode tests |
| `tests/engine/export/csvExport.test.ts` | CSV export tests |
| `tests/engine/export/tattooFormat.test.ts` | Tattoo format tests |

### Modified files

| File | Changes |
|------|---------|
| `src/engine/types.ts` | Add `PlanningMode`, `ClimbSegment`, update `PlannerInput`, `PlanSummary`, `RacePlan` |
| `src/engine/models/registry.ts` | Register ultrapacer model; export `PERSONAL_CALIBRATION_ID` sentinel |
| `src/engine/planner/pipeline.ts` | Branch on planning mode; integrate climb detection; accept custom model |
| `src/engine/planner/summary.ts` | Add `planningMode` to output; handle target-effort summary |
| `src/engine/planner/aggregateMiles.ts` | Extract generic aggregation helper for reuse by slowdown |
| `src/App.tsx` | Wire planning mode, slowdown, climb table, export controls |
| `src/ui/components/PlannerForm.tsx` | Add mode toggle, flat-equivalent pace input, personal calibration textarea, slowdown controls |
| `src/ui/components/SummaryPanel.tsx` | Display mode-appropriate labels; show slowdown summary |
| `src/ui/components/MileSplitsTable.tsx` | Conditionally show adjusted columns when slowdown active |

---

### Task 1: Ultrapacer hill model

**Files:**
- Create: `src/engine/models/ultrapacer.ts`
- Create: `tests/engine/models/ultrapacer.test.ts`
- Modify: `src/engine/models/registry.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/models/ultrapacer.test.ts
import { describe, it, expect } from "vitest";
import { ultrapacerDefaultMultiplier, ultrapacerModel } from "@engine/models/ultrapacer";

describe("ultrapacerDefaultMultiplier", () => {
  it("returns 1.0 on flat (grade 0)", () => {
    expect(ultrapacerDefaultMultiplier(0)).toBeCloseTo(1.0, 6);
  });

  it("returns > 1 for moderate uphill (grade 10%)", () => {
    // f = 0.0021*100 + 0.034*10 = 0.21 + 0.34 = 0.55
    expect(ultrapacerDefaultMultiplier(10)).toBeCloseTo(1.55, 4);
  });

  it("returns < 1 for moderate downhill (grade -10%)", () => {
    // f = 0.0021*100 + 0.034*(-10) = 0.21 - 0.34 = -0.13
    expect(ultrapacerDefaultMultiplier(-10)).toBeCloseTo(0.87, 4);
  });

  it("uses upper linear branch for grade > 16", () => {
    // f = 0.1012*20 - 0.4624 = 2.024 - 0.4624 = 1.5616
    expect(ultrapacerDefaultMultiplier(20)).toBeCloseTo(2.5616, 4);
  });

  it("uses lower linear branch for grade < -22", () => {
    // f = -0.0584*(-25) - 0.0164 = 1.46 - 0.0164 = 1.4436
    expect(ultrapacerDefaultMultiplier(-25)).toBeCloseTo(2.4436, 4);
  });

  it("is monotonically increasing from -10 to +10", () => {
    const grades = [-10, -5, 0, 5, 10];
    const values = grades.map((g) => ultrapacerDefaultMultiplier(g));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe("ultrapacerModel", () => {
  it("has correct metadata", () => {
    expect(ultrapacerModel.id).toBe("ultrapacer_default");
    expect(ultrapacerModel.kind).toBe("direct_multiplier");
    expect(ultrapacerModel.multiplier).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/ultrapacer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the ultrapacer model**

```ts
// src/engine/models/ultrapacer.ts
import type { PaceModel } from "@engine/types";

export function ultrapacerDefaultMultiplier(gradePct: number): number {
  let f: number;

  if (gradePct < -22) {
    f = -0.0584 * gradePct - 0.0164;
  } else if (gradePct > 16) {
    f = 0.1012 * gradePct - 0.4624;
  } else {
    f = 0.0021 * gradePct * gradePct + 0.034 * gradePct;
  }

  return 1 + f;
}

export const ultrapacerModel: PaceModel = {
  id: "ultrapacer_default",
  label: "Ultrapacer default grade model",
  kind: "direct_multiplier",
  provenance: "source-code",
  gradePctMin: -45,
  gradePctMax: 45,
  supportsDownhill: true,
  notes:
    "Piecewise quadratic/linear grade-to-multiplier heuristic from ultrapacer core defaults.",
  multiplier: ultrapacerDefaultMultiplier,
};
```

- [ ] **Step 4: Register in the model registry**

In `src/engine/models/registry.ts`, add the import and entry:

```ts
import { ultrapacerModel } from "./ultrapacer";
```

Add `ultrapacerModel` to the `ALL_MODELS` array (after `re3Model`):

```ts
const ALL_MODELS: PaceModel[] = [
  stravaInferredModel,
  minettiModel,
  re3Model,
  ultrapacerModel,
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/ultrapacer.test.ts`
Expected: PASS — all 6 tests pass

Run: `npx vitest run tests/engine/models/registry.test.ts`
Expected: PASS — existing registry tests still pass (model count may need updating if registry tests assert exact count)

- [ ] **Step 6: Commit**

```bash
git add src/engine/models/ultrapacer.ts tests/engine/models/ultrapacer.test.ts src/engine/models/registry.ts
git commit -m "feat: add ultrapacer default grade hill model"
```

---

### Task 2: Personal calibration model factory

**Files:**
- Create: `src/engine/models/personalCalibration.ts`
- Create: `tests/engine/models/personalCalibration.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/models/personalCalibration.test.ts
import { describe, it, expect } from "vitest";
import {
  createPersonalCalibrationModel,
  parseCalibrationText,
} from "@engine/models/personalCalibration";

describe("createPersonalCalibrationModel", () => {
  const points = [
    { gradePct: -10, multiplier: 0.85 },
    { gradePct: -5, multiplier: 0.92 },
    { gradePct: 0, multiplier: 1.0 },
    { gradePct: 5, multiplier: 1.2 },
    { gradePct: 10, multiplier: 1.5 },
    { gradePct: 15, multiplier: 2.0 },
  ];

  it("creates a valid PaceModel", () => {
    const model = createPersonalCalibrationModel(points);
    expect(model.id).toBe("personal_calibration");
    expect(model.kind).toBe("direct_multiplier");
    expect(model.multiplier).toBeDefined();
  });

  it("returns exact values at data points", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    expect(mult(0)).toBeCloseTo(1.0, 6);
    expect(mult(10)).toBeCloseTo(1.5, 6);
    expect(mult(-10)).toBeCloseTo(0.85, 6);
  });

  it("interpolates between data points", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    // Between 0 (1.0) and 5 (1.2): at 2.5, expect ~1.1
    expect(mult(2.5)).toBeCloseTo(1.1, 4);
  });

  it("clamps outside data range", () => {
    const model = createPersonalCalibrationModel(points);
    const mult = model.multiplier!;
    // Below range: clamp to value at -10
    expect(mult(-20)).toBeCloseTo(0.85, 6);
    // Above range: clamp to value at 15
    expect(mult(25)).toBeCloseTo(2.0, 6);
  });

  it("sets grade range from data points", () => {
    const model = createPersonalCalibrationModel(points);
    expect(model.gradePctMin).toBe(-10);
    expect(model.gradePctMax).toBe(15);
  });

  it("throws if fewer than 2 points", () => {
    expect(() =>
      createPersonalCalibrationModel([{ gradePct: 0, multiplier: 1 }])
    ).toThrow("at least 2");
  });

  it("handles unsorted input", () => {
    const shuffled = [
      { gradePct: 10, multiplier: 1.5 },
      { gradePct: -5, multiplier: 0.92 },
      { gradePct: 0, multiplier: 1.0 },
    ];
    const model = createPersonalCalibrationModel(shuffled);
    expect(model.multiplier!(0)).toBeCloseTo(1.0, 6);
    expect(model.multiplier!(5)).toBeCloseTo(1.25, 4);
  });
});

describe("parseCalibrationText", () => {
  it("parses comma-separated lines", () => {
    const text = "-10, 0.85\n0, 1.0\n10, 1.5";
    const points = parseCalibrationText(text);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ gradePct: -10, multiplier: 0.85 });
    expect(points[2]).toEqual({ gradePct: 10, multiplier: 1.5 });
  });

  it("skips blank lines and comments", () => {
    const text = "# my calibration\n-5, 0.92\n\n0, 1.0\n# uphill\n10, 1.5";
    const points = parseCalibrationText(text);
    expect(points).toHaveLength(3);
  });

  it("throws on invalid format", () => {
    expect(() => parseCalibrationText("bad data")).toThrow();
  });

  it("throws on empty input", () => {
    expect(() => parseCalibrationText("")).toThrow("No valid");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/personalCalibration.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the personal calibration model**

```ts
// src/engine/models/personalCalibration.ts
import type { PaceModel } from "@engine/types";
import { interp1d } from "@engine/utils/interpolation";

export interface CalibrationPoint {
  gradePct: number;
  multiplier: number;
}

export const PERSONAL_CALIBRATION_ID = "personal_calibration";

export function createPersonalCalibrationModel(
  points: CalibrationPoint[]
): PaceModel {
  if (points.length < 2) {
    throw new Error("Personal calibration requires at least 2 data points");
  }

  const sorted = [...points].sort((a, b) => a.gradePct - b.gradePct);
  const interpPoints: [number, number][] = sorted.map((p) => [
    p.gradePct,
    p.multiplier,
  ]);

  const minGrade = sorted[0]!.gradePct;
  const maxGrade = sorted[sorted.length - 1]!.gradePct;

  return {
    id: PERSONAL_CALIBRATION_ID,
    label: "Personal calibration",
    kind: "direct_multiplier",
    provenance: "user-inferred",
    gradePctMin: minGrade,
    gradePctMax: maxGrade,
    supportsDownhill: minGrade < 0,
    notes: `User-provided calibration with ${points.length} data points. Linear interpolation, clamped outside [${minGrade}%, ${maxGrade}%].`,
    warning:
      "Personal calibration model — values outside your calibration range are clamped to boundary values.",
    multiplier: (gradePct: number) => interp1d(interpPoints, gradePct),
  };
}

export function parseCalibrationText(text: string): CalibrationPoint[] {
  const lines = text.split("\n");
  const points: CalibrationPoint[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const parts = line.split(",");
    if (parts.length !== 2) {
      throw new Error(`Invalid calibration line: "${line}" — expected "gradePct, multiplier"`);
    }

    const gradePct = parseFloat(parts[0]!.trim());
    const multiplier = parseFloat(parts[1]!.trim());

    if (isNaN(gradePct) || isNaN(multiplier)) {
      throw new Error(`Invalid numbers in calibration line: "${line}"`);
    }

    points.push({ gradePct, multiplier });
  }

  if (points.length === 0) {
    throw new Error("No valid calibration data found");
  }

  return points;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/personalCalibration.test.ts`
Expected: PASS — all 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/models/personalCalibration.ts tests/engine/models/personalCalibration.test.ts
git commit -m "feat: add personal calibration model factory with text parser"
```

---

### Task 3: Target effort mode — types and solver

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/planner/targetEffort.ts`
- Create: `tests/engine/planner/targetEffort.test.ts`

- [ ] **Step 1: Add types to `src/engine/types.ts`**

Add after the `SmoothingLevel` type:

```ts
export type PlanningMode = "target_time" | "target_effort";
```

Replace the existing `PlannerInput` interface with:

```ts
export interface PlannerInput {
  gpxData: string;
  modelId: string;
  segmentDistanceMeters?: number;
  smoothing?: SmoothingLevel;
  planningMode?: PlanningMode;
  /** Required when planningMode is "target_time" (default) */
  targetFinishTimeSec?: number;
  /** Required when planningMode is "target_effort". Flat-equivalent pace in sec/mile. */
  flatEquivalentPaceSecPerMile?: number;
  /** Optional override model — used for personal calibration */
  customModel?: PaceModel;
}
```

Add to the `PlanSummary` interface:

```ts
export interface PlanSummary {
  planningMode: PlanningMode;
  modelId: string;
  modelLabel: string;
  targetFinishTimeSec: number;
  computedFinishTimeSec: number;
  courseLengthMeters: number;
  totalClimbMeters: number;
  totalDescentMeters: number;
  flatEquivalentPaceSecPerMile: number;
  weightedDistanceMeters: number;
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/engine/planner/targetEffort.test.ts
import { describe, it, expect } from "vitest";
import { propagateEffort } from "@engine/planner/targetEffort";
import type { Microsegment, PaceModel } from "@engine/types";
import { paceSecPerMileToSpeedMps, METERS_PER_MILE } from "@engine/utils/units";

// Simple test model: multiplier = 1 + 0.05 * gradePct
const testMultiplierModel: PaceModel = {
  id: "test_mult",
  label: "Test multiplier",
  kind: "direct_multiplier",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes: "Test",
  multiplier: (g: number) => 1 + 0.05 * g,
};

// Simple demand model where hillSpeed = flatSpeed / (1 + 0.05 * grade)
const testDemandModel: PaceModel = {
  id: "test_demand",
  label: "Test demand",
  kind: "demand_model",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes: "Test",
  hillSpeedFromFlatSpeed: (flatSpeed: number, gradePct: number) =>
    flatSpeed / (1 + 0.05 * gradePct),
};

function makeSegments(grades: number[], distEach: number): Microsegment[] {
  return grades.map((g, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 100,
    endElevation: 100 + (g / 100) * distEach,
    avgGradePct: g,
  }));
}

describe("propagateEffort — direct multiplier", () => {
  const segments = makeSegments([0, 5, -5, 10], 1000);
  // 12:00/mi flat pace
  const flatSpeedMps = paceSecPerMileToSpeedMps(720);

  it("flat segment uses the input flat pace", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    const flatSeg = result[0]!;
    // M(0) = 1.0, so pace = 1/flatSpeed * 1.0
    const expectedPace = 1 / flatSpeedMps;
    expect(flatSeg.targetPaceSecPerMeter).toBeCloseTo(expectedPace, 6);
  });

  it("uphill segment is slower than flat", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    expect(result[1]!.targetPaceSecPerMeter).toBeGreaterThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("downhill segment is faster than flat", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    expect(result[2]!.targetPaceSecPerMeter).toBeLessThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("cumulative elapsed increases monotonically", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.cumulativeElapsedSec).toBeGreaterThan(
        result[i - 1]!.cumulativeElapsedSec
      );
    }
  });

  it("total time equals sum of segment times", () => {
    const result = propagateEffort(segments, testMultiplierModel, flatSpeedMps);
    const totalFromSum = result.reduce((s, r) => s + r.targetTimeSec, 0);
    const last = result[result.length - 1]!;
    expect(last.cumulativeElapsedSec).toBeCloseTo(totalFromSum, 6);
  });
});

describe("propagateEffort — demand model", () => {
  const segments = makeSegments([0, 5, -5], 1000);
  const flatSpeedMps = paceSecPerMileToSpeedMps(720);

  it("flat segment speed equals input flat speed", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    const flatSeg = result[0]!;
    // hillSpeed at grade 0 = flatSpeed / 1.0 = flatSpeed
    const expectedSpeed = flatSpeedMps;
    expect(1 / flatSeg.targetPaceSecPerMeter).toBeCloseTo(expectedSpeed, 4);
  });

  it("uphill segment is slower than flat", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    expect(result[1]!.targetPaceSecPerMeter).toBeGreaterThan(
      result[0]!.targetPaceSecPerMeter
    );
  });

  it("total time equals sum of segment times", () => {
    const result = propagateEffort(segments, testDemandModel, flatSpeedMps);
    const totalFromSum = result.reduce((s, r) => s + r.targetTimeSec, 0);
    const last = result[result.length - 1]!;
    expect(last.cumulativeElapsedSec).toBeCloseTo(totalFromSum, 6);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/planner/targetEffort.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the target effort solver**

```ts
// src/engine/planner/targetEffort.ts
import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";

function propagateMultiplier(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  const mult = model.multiplier!;
  const flatPaceSecPerMeter = 1 / flatSpeedMps;

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const m = mult(seg.avgGradePct);
    const pace = flatPaceSecPerMeter * m;
    const time = seg.distance * pace;
    cumElapsed += time;

    return {
      segmentId: i,
      startDistance: seg.startDistance,
      endDistance: seg.endDistance,
      distance: seg.distance,
      avgGradePct: seg.avgGradePct,
      modelValue: m,
      targetPaceSecPerMeter: pace,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

function propagateDemand(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  const hillSpeed = model.hillSpeedFromFlatSpeed!;

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
    const pace = 1 / vh;
    const time = seg.distance / vh;
    cumElapsed += time;

    return {
      segmentId: i,
      startDistance: seg.startDistance,
      endDistance: seg.endDistance,
      distance: seg.distance,
      avgGradePct: seg.avgGradePct,
      modelValue: vh,
      targetPaceSecPerMeter: pace,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

export function propagateEffort(
  segments: Microsegment[],
  model: PaceModel,
  flatSpeedMps: number
): SegmentResult[] {
  if (model.kind === "demand_model" && model.hillSpeedFromFlatSpeed) {
    return propagateDemand(segments, model, flatSpeedMps);
  }

  if (model.multiplier) {
    return propagateMultiplier(segments, model, flatSpeedMps);
  }

  throw new Error(
    `Model "${model.id}" has neither multiplier nor hillSpeedFromFlatSpeed`
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/planner/targetEffort.test.ts`
Expected: PASS — all 8 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/planner/targetEffort.ts tests/engine/planner/targetEffort.test.ts
git commit -m "feat: add target effort mode types and solver"
```

---

### Task 4: Target effort mode — pipeline integration

**Files:**
- Modify: `src/engine/planner/pipeline.ts`
- Modify: `src/engine/planner/summary.ts`

- [ ] **Step 1: Update `summary.ts` to accept planning mode**

Replace the `computeSummary` function signature and body in `src/engine/planner/summary.ts`:

```ts
import type {
  Microsegment,
  SegmentResult,
  PaceModel,
  PlanSummary,
  PlanningMode,
} from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function computeSummary(
  microsegments: Microsegment[],
  results: SegmentResult[],
  model: PaceModel,
  targetFinishTimeSec: number,
  planningMode: PlanningMode = "target_time"
): PlanSummary {
  const last = microsegments[microsegments.length - 1]!;
  const courseLengthMeters = last.endDistance;

  let totalClimb = 0;
  let totalDescent = 0;
  for (const seg of microsegments) {
    const diff = seg.endElevation - seg.startElevation;
    if (diff > 0) totalClimb += diff;
    else totalDescent += Math.abs(diff);
  }

  const lastResult = results[results.length - 1]!;
  const computedFinishTimeSec = lastResult.cumulativeElapsedSec;

  const weightedDistance = results.reduce(
    (sum, r) => sum + r.distance * r.modelValue,
    0
  );

  const flatEqPaceSecPerMeter =
    model.kind === "demand_model"
      ? computedFinishTimeSec / courseLengthMeters
      : targetFinishTimeSec / weightedDistance;

  const flatEquivalentPaceSecPerMile = flatEqPaceSecPerMeter * METERS_PER_MILE;

  return {
    planningMode,
    modelId: model.id,
    modelLabel: model.label,
    targetFinishTimeSec,
    computedFinishTimeSec,
    courseLengthMeters,
    totalClimbMeters: totalClimb,
    totalDescentMeters: totalDescent,
    flatEquivalentPaceSecPerMile,
    weightedDistanceMeters: weightedDistance,
  };
}
```

- [ ] **Step 2: Update `pipeline.ts` to support both planning modes**

Replace the full content of `src/engine/planner/pipeline.ts`:

```ts
import type { PlannerInput, RacePlan } from "@engine/types";
import { parseGpx } from "@engine/course/parseGpx";
import {
  rawPointsToCoursePoints,
  resampleToMicrosegments,
} from "@engine/course/resampleCourse";
import { smoothElevation } from "@engine/course/smoothElevation";
import { getModel } from "@engine/models/registry";
import { solveWholeCourse } from "./solver";
import { propagateEffort } from "./targetEffort";
import { aggregateMileSplits } from "./aggregateMiles";
import { computeSummary } from "./summary";
import { paceSecPerMileToSpeedMps } from "@engine/utils/units";

const DEFAULT_SEGMENT_DISTANCE = 160.934; // ~0.1 miles in meters

export function generateRacePlan(input: PlannerInput): RacePlan {
  const warnings: string[] = [];
  const mode = input.planningMode ?? "target_time";

  // Validate mode-specific inputs
  if (mode === "target_time" && input.targetFinishTimeSec == null) {
    throw new Error("targetFinishTimeSec is required for target_time mode");
  }
  if (mode === "target_effort" && input.flatEquivalentPaceSecPerMile == null) {
    throw new Error(
      "flatEquivalentPaceSecPerMile is required for target_effort mode"
    );
  }

  // 1. Parse GPX
  const rawPoints = parseGpx(input.gpxData);

  // 2. Convert to course points with cumulative distance
  const coursePoints = rawPointsToCoursePoints(rawPoints);

  // 3. Smooth elevation
  const smoothed = smoothElevation(coursePoints, input.smoothing ?? "light");

  // 4. Resample to microsegments
  const segmentDist = input.segmentDistanceMeters ?? DEFAULT_SEGMENT_DISTANCE;
  const microsegments = resampleToMicrosegments(smoothed, segmentDist);

  // 5. Get model
  const model = input.customModel ?? getModel(input.modelId);

  if (model.warning) {
    warnings.push(model.warning);
  }

  // Check grade range warnings
  const grades = microsegments.map((s) => s.avgGradePct);
  const minGrade = Math.min(...grades);
  const maxGrade = Math.max(...grades);
  if (minGrade < model.gradePctMin || maxGrade > model.gradePctMax) {
    warnings.push(
      `Course grades (${minGrade.toFixed(1)}% to ${maxGrade.toFixed(1)}%) exceed model's recommended range (${model.gradePctMin}% to ${model.gradePctMax}%).`
    );
  }

  // 6. Solve based on planning mode
  let segmentResults;
  let targetTimeSec: number;

  if (mode === "target_effort") {
    const flatSpeedMps = paceSecPerMileToSpeedMps(
      input.flatEquivalentPaceSecPerMile!
    );
    segmentResults = propagateEffort(microsegments, model, flatSpeedMps);
    // In target effort mode, the "target" is the computed projection
    targetTimeSec =
      segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec;
  } else {
    targetTimeSec = input.targetFinishTimeSec!;
    segmentResults = solveWholeCourse(microsegments, model, targetTimeSec);
  }

  // 7. Aggregate mile splits
  const mileSplits = aggregateMileSplits(segmentResults);

  // 8. Compute summary
  const summary = computeSummary(
    microsegments,
    segmentResults,
    model,
    targetTimeSec,
    mode
  );

  return { summary, segments: segmentResults, mileSplits, warnings };
}
```

- [ ] **Step 3: Run all existing tests to verify nothing is broken**

Run: `npx vitest run`
Expected: ALL PASS — the `planningMode` field was added to `PlanSummary`, which may require updating `summary.test.ts` to expect the new field.

If `summary.test.ts` fails because the output now includes `planningMode`, update the test assertions to expect `planningMode: "target_time"`.

- [ ] **Step 4: Commit**

```bash
git add src/engine/planner/pipeline.ts src/engine/planner/summary.ts
git commit -m "feat: integrate target effort mode into pipeline"
```

---

### Task 5: Target effort mode — UI

**Files:**
- Modify: `src/ui/components/PlannerForm.tsx`
- Modify: `src/ui/components/SummaryPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update PlannerForm to support mode toggle and flat pace input**

Replace `src/ui/components/PlannerForm.tsx`:

```tsx
import type { PlanningMode, SmoothingLevel } from "@engine/types";
import { listModels } from "@engine/models/registry";
import { PERSONAL_CALIBRATION_ID } from "@engine/models/personalCalibration";

interface PlannerFormProps {
  planningMode: PlanningMode;
  onPlanningModeChange: (mode: PlanningMode) => void;
  targetTime: string;
  onTargetTimeChange: (value: string) => void;
  flatEquivalentPace: string;
  onFlatEquivalentPaceChange: (value: string) => void;
  modelId: string;
  onModelIdChange: (value: string) => void;
  calibrationText: string;
  onCalibrationTextChange: (value: string) => void;
  smoothing: SmoothingLevel;
  onSmoothingChange: (value: SmoothingLevel) => void;
  canRun: boolean;
  onRun: () => void;
}

export function PlannerForm({
  planningMode,
  onPlanningModeChange,
  targetTime,
  onTargetTimeChange,
  flatEquivalentPace,
  onFlatEquivalentPaceChange,
  modelId,
  onModelIdChange,
  calibrationText,
  onCalibrationTextChange,
  smoothing,
  onSmoothingChange,
  canRun,
  onRun,
}: PlannerFormProps) {
  const models = listModels();

  return (
    <div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="planning-mode">Planning mode</label>
          <select
            id="planning-mode"
            value={planningMode}
            onChange={(e) =>
              onPlanningModeChange(e.target.value as PlanningMode)
            }
          >
            <option value="target_time">Target finish time</option>
            <option value="target_effort">Target effort (flat pace)</option>
          </select>
        </div>

        {planningMode === "target_time" ? (
          <div className="form-group">
            <label htmlFor="target-time">Target finish time</label>
            <input
              id="target-time"
              type="text"
              placeholder="14:00 or 840 (minutes)"
              value={targetTime}
              onChange={(e) => onTargetTimeChange(e.target.value)}
            />
          </div>
        ) : (
          <div className="form-group">
            <label htmlFor="flat-pace">Flat-equivalent pace (min:sec /mi)</label>
            <input
              id="flat-pace"
              type="text"
              placeholder="12:30"
              value={flatEquivalentPace}
              onChange={(e) => onFlatEquivalentPaceChange(e.target.value)}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="model-select">Hill model</label>
          <select
            id="model-select"
            value={modelId}
            onChange={(e) => onModelIdChange(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={PERSONAL_CALIBRATION_ID}>
              Personal calibration
            </option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="smoothing-select">Elevation smoothing</label>
          <select
            id="smoothing-select"
            value={smoothing}
            onChange={(e) =>
              onSmoothingChange(e.target.value as SmoothingLevel)
            }
          >
            <option value="none">None</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
      </div>

      {modelId === PERSONAL_CALIBRATION_ID && (
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="calibration-text">
            Calibration data (grade%, multiplier — one pair per line)
          </label>
          <textarea
            id="calibration-text"
            rows={6}
            placeholder={"-10, 0.85\n-5, 0.92\n0, 1.0\n5, 1.2\n10, 1.5"}
            value={calibrationText}
            onChange={(e) => onCalibrationTextChange(e.target.value)}
            style={{ fontFamily: "monospace", width: "100%" }}
          />
        </div>
      )}

      <button disabled={!canRun} onClick={onRun}>
        Generate Plan
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update SummaryPanel for mode-aware labels**

Replace `src/ui/components/SummaryPanel.tsx`:

```tsx
import type { PlanSummary } from "@engine/types";
import {
  formatPace,
  formatElapsedTime,
} from "@engine/utils/paceFormatting";
import { metersToMiles, metersToFeet } from "@engine/utils/units";

interface SummaryPanelProps {
  summary: PlanSummary;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  const isEffortMode = summary.planningMode === "target_effort";

  return (
    <div>
      <h2>Plan Summary</h2>
      <dl className="summary-grid">
        <dt>Hill model</dt>
        <dd>{summary.modelLabel}</dd>

        <dt>{isEffortMode ? "Projected finish time" : "Target finish time"}</dt>
        <dd>{formatElapsedTime(summary.targetFinishTimeSec)}</dd>

        {!isEffortMode && (
          <>
            <dt>Computed finish time</dt>
            <dd>{formatElapsedTime(summary.computedFinishTimeSec)}</dd>
          </>
        )}

        <dt>Course length</dt>
        <dd>{metersToMiles(summary.courseLengthMeters).toFixed(2)} mi</dd>

        <dt>Total climb</dt>
        <dd>{metersToFeet(summary.totalClimbMeters).toFixed(0)} ft</dd>

        <dt>Total descent</dt>
        <dd>{metersToFeet(summary.totalDescentMeters).toFixed(0)} ft</dd>

        <dt>
          {isEffortMode
            ? "Input flat-equivalent pace"
            : "Flat-equivalent pace"}
        </dt>
        <dd>{formatPace(summary.flatEquivalentPaceSecPerMile)} /mi</dd>
      </dl>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to wire new state**

Replace `src/App.tsx`:

```tsx
import { useState, useCallback } from "react";
import type { RacePlan, PlanningMode, SmoothingLevel } from "@engine/types";
import { parseTargetTime } from "@engine/utils/paceFormatting";
import { generateRacePlan } from "@engine/planner/pipeline";
import {
  createPersonalCalibrationModel,
  parseCalibrationText,
  PERSONAL_CALIBRATION_ID,
} from "@engine/models/personalCalibration";
import { CourseUpload } from "@ui/components/CourseUpload";
import { PlannerForm } from "@ui/components/PlannerForm";
import { SummaryPanel } from "@ui/components/SummaryPanel";
import { MileSplitsTable } from "@ui/components/MileSplitsTable";
import "./App.css";

function parseFlatPaceToSecPerMile(input: string): number {
  const trimmed = input.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const min = parseInt(parts[0]!, 10);
    const sec = parseInt(parts[1]!, 10);
    if (isNaN(min) || isNaN(sec)) throw new Error(`Invalid pace: ${input}`);
    return min * 60 + sec;
  }
  const val = parseFloat(trimmed);
  if (isNaN(val)) throw new Error(`Invalid pace: ${input}`);
  return val * 60;
}

export default function App() {
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("target_time");
  const [targetTime, setTargetTime] = useState("14:00");
  const [flatEquivalentPace, setFlatEquivalentPace] = useState("12:30");
  const [modelId, setModelId] = useState("strava_inferred");
  const [calibrationText, setCalibrationText] = useState("");
  const [smoothing, setSmoothing] = useState<SmoothingLevel>("light");
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback((data: string, name: string) => {
    setGpxData(data);
    setFileName(name);
    setPlan(null);
    setError(null);
  }, []);

  const handleRun = useCallback(() => {
    if (!gpxData) return;

    try {
      let customModel;
      if (modelId === PERSONAL_CALIBRATION_ID) {
        const points = parseCalibrationText(calibrationText);
        customModel = createPersonalCalibrationModel(points);
      }

      const result = generateRacePlan({
        gpxData,
        modelId,
        customModel,
        smoothing,
        planningMode,
        targetFinishTimeSec:
          planningMode === "target_time"
            ? parseTargetTime(targetTime)
            : undefined,
        flatEquivalentPaceSecPerMile:
          planningMode === "target_effort"
            ? parseFlatPaceToSecPerMile(flatEquivalentPace)
            : undefined,
      });
      setPlan(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlan(null);
    }
  }, [
    gpxData,
    planningMode,
    targetTime,
    flatEquivalentPace,
    modelId,
    calibrationText,
    smoothing,
  ]);

  const canRun = gpxData !== null;

  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>

      <CourseUpload onFileLoaded={handleFileLoaded} />
      {fileName && <p>Loaded: {fileName}</p>}

      <PlannerForm
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        targetTime={targetTime}
        onTargetTimeChange={setTargetTime}
        flatEquivalentPace={flatEquivalentPace}
        onFlatEquivalentPaceChange={setFlatEquivalentPace}
        modelId={modelId}
        onModelIdChange={setModelId}
        calibrationText={calibrationText}
        onCalibrationTextChange={setCalibrationText}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        canRun={canRun}
        onRun={handleRun}
      />

      {error && <div className="warning">{error}</div>}

      {plan && (
        <>
          {plan.warnings.map((w, i) => (
            <div key={i} className="warning">
              {w}
            </div>
          ))}
          <SummaryPanel summary={plan.summary} />
          <MileSplitsTable splits={plan.mileSplits} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/ui/components/PlannerForm.tsx src/ui/components/SummaryPanel.tsx
git commit -m "feat: add target effort mode and personal calibration UI"
```

---

### Task 6: Climb/descent detection — engine

**Files:**
- Modify: `src/engine/types.ts` (add `ClimbSegment`)
- Create: `src/engine/planner/climbDetection.ts`
- Create: `tests/engine/planner/climbDetection.test.ts`

- [ ] **Step 1: Add ClimbSegment type to `src/engine/types.ts`**

Add after the `MileSplit` interface:

```ts
export interface ClimbSegment {
  startDistance: number;
  endDistance: number;
  distance: number;
  elevationChange: number;
  avgGradePct: number;
  type: "climb" | "descent";
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/engine/planner/climbDetection.test.ts
import { describe, it, expect } from "vitest";
import { detectClimbs } from "@engine/planner/climbDetection";
import type { Microsegment } from "@engine/types";

function makeSegments(
  specs: { grade: number; dist: number; startDist: number; startEle: number }[]
): Microsegment[] {
  return specs.map((s) => {
    const elevChange = (s.grade / 100) * s.dist;
    return {
      startDistance: s.startDist,
      endDistance: s.startDist + s.dist,
      distance: s.dist,
      startElevation: s.startEle,
      endElevation: s.startEle + elevChange,
      avgGradePct: s.grade,
    };
  });
}

describe("detectClimbs", () => {
  it("returns empty for flat course", () => {
    const segs = makeSegments([
      { grade: 0, dist: 1000, startDist: 0, startEle: 100 },
      { grade: 0.5, dist: 1000, startDist: 1000, startEle: 100 },
      { grade: -0.5, dist: 1000, startDist: 2000, startEle: 105 },
    ]);
    const climbs = detectClimbs(segs);
    expect(climbs).toHaveLength(0);
  });

  it("detects a single significant climb", () => {
    // 10 segments of 5% uphill, 200m each = 2000m distance, 100m gain
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      const startDist = i * 200;
      const startEle = 100 + i * 10;
      segs.push({
        startDistance: startDist,
        endDistance: startDist + 200,
        distance: 200,
        startElevation: startEle,
        endElevation: startEle + 10,
        avgGradePct: 5,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs.length).toBeGreaterThanOrEqual(1);
    const climb = climbs.find((c) => c.type === "climb");
    expect(climb).toBeDefined();
    expect(climb!.elevationChange).toBeCloseTo(100, 0);
  });

  it("detects a significant descent", () => {
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      const startDist = i * 200;
      const startEle = 200 - i * 10;
      segs.push({
        startDistance: startDist,
        endDistance: startDist + 200,
        distance: 200,
        startElevation: startEle,
        endElevation: startEle - 10,
        avgGradePct: -5,
      });
    }
    const climbs = detectClimbs(segs);
    const descent = climbs.find((c) => c.type === "descent");
    expect(descent).toBeDefined();
    expect(descent!.elevationChange).toBeCloseTo(100, 0);
  });

  it("ignores small elevation changes below threshold", () => {
    // 5 segments of 3% uphill, 100m each = 500m distance, 15m gain (below default 30m threshold)
    const segs: Microsegment[] = [];
    for (let i = 0; i < 5; i++) {
      segs.push({
        startDistance: i * 100,
        endDistance: (i + 1) * 100,
        distance: 100,
        startElevation: 100 + i * 3,
        endElevation: 100 + (i + 1) * 3,
        avgGradePct: 3,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs).toHaveLength(0);
  });

  it("detects climb then descent as separate entries", () => {
    const segs: Microsegment[] = [];
    // 10 uphill segments: 5%, 200m each = 100m gain
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: i * 200,
        endDistance: (i + 1) * 200,
        distance: 200,
        startElevation: 100 + i * 10,
        endElevation: 110 + i * 10,
        avgGradePct: 5,
      });
    }
    // 10 downhill segments: -5%, 200m each = 100m loss
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: 2000 + i * 200,
        endDistance: 2000 + (i + 1) * 200,
        distance: 200,
        startElevation: 200 - i * 10,
        endElevation: 190 - i * 10,
        avgGradePct: -5,
      });
    }
    const climbs = detectClimbs(segs);
    expect(climbs.length).toBe(2);
    expect(climbs[0]!.type).toBe("climb");
    expect(climbs[1]!.type).toBe("descent");
  });

  it("returns empty for empty input", () => {
    expect(detectClimbs([])).toHaveLength(0);
  });

  it("respects custom minGainMeters", () => {
    // 10 segments of 5% uphill, 200m each = 100m gain
    const segs: Microsegment[] = [];
    for (let i = 0; i < 10; i++) {
      segs.push({
        startDistance: i * 200,
        endDistance: (i + 1) * 200,
        distance: 200,
        startElevation: 100 + i * 10,
        endElevation: 110 + i * 10,
        avgGradePct: 5,
      });
    }
    // With threshold 200m, this 100m climb should be filtered out
    expect(detectClimbs(segs, { minGainMeters: 200 })).toHaveLength(0);
    // With threshold 50m, it should be detected
    expect(detectClimbs(segs, { minGainMeters: 50 }).length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/planner/climbDetection.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement climb detection**

```ts
// src/engine/planner/climbDetection.ts
import type { Microsegment, ClimbSegment } from "@engine/types";

const DEFAULT_FLAT_THRESHOLD_PCT = 2;
const DEFAULT_MIN_GAIN_METERS = 30;

export interface ClimbDetectionOptions {
  minGainMeters?: number;
  flatThresholdPct?: number;
}

type Direction = "climb" | "descent" | "flat";

function classify(gradePct: number, threshold: number): Direction {
  if (gradePct > threshold) return "climb";
  if (gradePct < -threshold) return "descent";
  return "flat";
}

export function detectClimbs(
  segments: Microsegment[],
  options: ClimbDetectionOptions = {}
): ClimbSegment[] {
  const minGain = options.minGainMeters ?? DEFAULT_MIN_GAIN_METERS;
  const flatThreshold = options.flatThresholdPct ?? DEFAULT_FLAT_THRESHOLD_PCT;

  if (segments.length === 0) return [];

  // Step 1: classify each segment
  const dirs: Direction[] = segments.map((s) =>
    classify(s.avgGradePct, flatThreshold)
  );

  // Step 2: merge flat segments into adjacent non-flat direction
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i] === "flat") {
      // Look backward for nearest non-flat
      for (let j = i - 1; j >= 0; j--) {
        if (dirs[j] !== "flat") {
          dirs[i] = dirs[j]!;
          break;
        }
      }
    }
  }

  // If all are still flat, no climbs
  if (dirs.every((d) => d === "flat")) return [];

  // Step 3: group consecutive same-direction segments
  const groups: { dir: Direction; startIdx: number; endIdx: number }[] = [];
  let groupStart = 0;
  for (let i = 1; i <= dirs.length; i++) {
    if (i === dirs.length || dirs[i] !== dirs[groupStart]) {
      groups.push({
        dir: dirs[groupStart]!,
        startIdx: groupStart,
        endIdx: i - 1,
      });
      groupStart = i;
    }
  }

  // Step 4: compute elevation change per group, filter by threshold
  const climbs: ClimbSegment[] = [];

  for (const group of groups) {
    if (group.dir === "flat") continue;

    const groupSegs = segments.slice(group.startIdx, group.endIdx + 1);
    const first = groupSegs[0]!;
    const last = groupSegs[groupSegs.length - 1]!;
    const startDist = first.startDistance;
    const endDist = last.endDistance;
    const dist = endDist - startDist;

    let gain = 0;
    let loss = 0;
    for (const s of groupSegs) {
      const diff = s.endElevation - s.startElevation;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    const elevationChange = group.dir === "climb" ? gain : loss;

    if (elevationChange >= minGain && dist > 0) {
      climbs.push({
        startDistance: startDist,
        endDistance: endDist,
        distance: dist,
        elevationChange,
        avgGradePct:
          group.dir === "climb"
            ? (gain / dist) * 100
            : -(loss / dist) * 100,
        type: group.dir,
      });
    }
  }

  return climbs;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/planner/climbDetection.test.ts`
Expected: PASS — all 7 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/planner/climbDetection.ts tests/engine/planner/climbDetection.test.ts
git commit -m "feat: add climb/descent detection from microsegments"
```

---

### Task 7: Climb detection — pipeline integration and UI

**Files:**
- Modify: `src/engine/types.ts` (update `RacePlan`)
- Modify: `src/engine/planner/pipeline.ts`
- Create: `src/ui/components/ClimbTable.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add climbs to RacePlan in `src/engine/types.ts`**

Update the `RacePlan` interface:

```ts
export interface RacePlan {
  summary: PlanSummary;
  segments: SegmentResult[];
  mileSplits: MileSplit[];
  climbs: ClimbSegment[];
  warnings: string[];
}
```

- [ ] **Step 2: Integrate climb detection into pipeline**

In `src/engine/planner/pipeline.ts`, add the import:

```ts
import { detectClimbs } from "./climbDetection";
```

After the mile splits aggregation (step 7) and before the summary (step 8), add:

```ts
  // 7b. Detect climbs
  const climbs = detectClimbs(microsegments);
```

Update the return statement:

```ts
  return { summary, segments: segmentResults, mileSplits, climbs, warnings };
```

- [ ] **Step 3: Create the ClimbTable UI component**

```tsx
// src/ui/components/ClimbTable.tsx
import type { ClimbSegment } from "@engine/types";
import { metersToMiles, metersToFeet } from "@engine/utils/units";

interface ClimbTableProps {
  climbs: ClimbSegment[];
}

export function ClimbTable({ climbs }: ClimbTableProps) {
  if (climbs.length === 0) return null;

  return (
    <div>
      <h2>Climbs &amp; Descents</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Start (mi)</th>
            <th>End (mi)</th>
            <th>Distance (mi)</th>
            <th>Elev Change (ft)</th>
            <th>Avg Grade</th>
          </tr>
        </thead>
        <tbody>
          {climbs.map((c, i) => (
            <tr key={i}>
              <td>{c.type === "climb" ? "Climb" : "Descent"}</td>
              <td>{metersToMiles(c.startDistance).toFixed(1)}</td>
              <td>{metersToMiles(c.endDistance).toFixed(1)}</td>
              <td>{metersToMiles(c.distance).toFixed(2)}</td>
              <td>{metersToFeet(c.elevationChange).toFixed(0)}</td>
              <td>{c.avgGradePct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Wire ClimbTable into App.tsx**

Add the import to `src/App.tsx`:

```tsx
import { ClimbTable } from "@ui/components/ClimbTable";
```

In the render section, add after `<MileSplitsTable>`:

```tsx
          <ClimbTable climbs={plan.climbs} />
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS — update any pipeline tests that assert the shape of `RacePlan` to include the `climbs` field.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/planner/pipeline.ts src/ui/components/ClimbTable.tsx src/App.tsx
git commit -m "feat: integrate climb detection into pipeline and add climb table UI"
```

---

### Task 8: Slowdown — types, presets, and core function

**Files:**
- Create: `src/engine/slowdown/types.ts`
- Create: `src/engine/slowdown/slowdownFunction.ts`
- Create: `tests/engine/slowdown/slowdownFunction.test.ts`

- [ ] **Step 1: Create slowdown types and presets**

```ts
// src/engine/slowdown/types.ts
export type SlowdownMode = "forecast" | "compensate_to_target";

export type SlowdownPreset =
  | "none"
  | "controlled_late_fade"
  | "gentle_late_fade"
  | "moderate_late_fade"
  | "wall_lite"
  | "classic_wall"
  | "early_blowup"
  | "custom";

export interface SlowdownScenarioConfig {
  preset: SlowdownPreset;
  mode: SlowdownMode;
  onsetDistanceMeters: number;
  rampDistanceMeters: number;
  plateauSlowdownFraction: number;
}

export interface AdjustedSegment {
  segmentId: number;
  slowdownFraction: number;
  baselinePaceSecPerMeter: number;
  adjustedPaceSecPerMeter: number;
  baselineTimeSec: number;
  adjustedTimeSec: number;
  cumulativeAdjustedElapsedSec: number;
}

export interface AdjustedMileSplit {
  mile: number;
  baselinePaceSecPerMile: number;
  adjustedPaceSecPerMile: number;
  baselineElapsedSec: number;
  adjustedElapsedSec: number;
}

export interface SlowdownResult {
  config: SlowdownScenarioConfig;
  baselineFinishTimeSec: number;
  adjustedFinishTimeSec: number;
  slowdownCostSec: number;
  adjustedSegments: AdjustedSegment[];
  adjustedMileSplits: AdjustedMileSplit[];
  /** Only present in compensate_to_target mode */
  internalTargetTimeSec?: number;
}

export const SLOWDOWN_PRESET_CONFIGS: Record<
  Exclude<SlowdownPreset, "none" | "custom">,
  Omit<SlowdownScenarioConfig, "preset" | "mode">
> = {
  controlled_late_fade: {
    onsetDistanceMeters: 37000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.02,
  },
  gentle_late_fade: {
    onsetDistanceMeters: 32000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.05,
  },
  moderate_late_fade: {
    onsetDistanceMeters: 31000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.1,
  },
  wall_lite: {
    onsetDistanceMeters: 31000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.2,
  },
  classic_wall: {
    onsetDistanceMeters: 30000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.3,
  },
  early_blowup: {
    onsetDistanceMeters: 27000,
    rampDistanceMeters: 4000,
    plateauSlowdownFraction: 0.25,
  },
};

export const SLOWDOWN_PRESET_LABELS: Record<SlowdownPreset, string> = {
  none: "No slowdown",
  controlled_late_fade: "Controlled / tiny late fade",
  gentle_late_fade: "Gentle late fade",
  moderate_late_fade: "Moderate late fade",
  wall_lite: "Wall-lite",
  classic_wall: "Classic wall",
  early_blowup: "Early blow-up",
  custom: "Custom",
};

export function resolveSlowdownConfig(
  preset: SlowdownPreset,
  mode: SlowdownMode,
  custom?: Partial<Pick<SlowdownScenarioConfig, "onsetDistanceMeters" | "rampDistanceMeters" | "plateauSlowdownFraction">>
): SlowdownScenarioConfig {
  if (preset === "none") {
    return {
      preset,
      mode,
      onsetDistanceMeters: 0,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0,
    };
  }

  if (preset === "custom") {
    return {
      preset,
      mode,
      onsetDistanceMeters: custom?.onsetDistanceMeters ?? 30000,
      rampDistanceMeters: custom?.rampDistanceMeters ?? 3000,
      plateauSlowdownFraction: custom?.plateauSlowdownFraction ?? 0.1,
    };
  }

  const base = SLOWDOWN_PRESET_CONFIGS[preset];
  return { preset, mode, ...base };
}
```

- [ ] **Step 2: Write the failing tests for the core slowdown function**

```ts
// tests/engine/slowdown/slowdownFunction.test.ts
import { describe, it, expect } from "vitest";
import { slowdownFraction } from "@engine/slowdown/slowdownFunction";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";

function makeConfig(
  overrides: Partial<SlowdownScenarioConfig> = {}
): SlowdownScenarioConfig {
  return {
    preset: "custom",
    mode: "forecast",
    onsetDistanceMeters: 30000,
    rampDistanceMeters: 3000,
    plateauSlowdownFraction: 0.1,
    ...overrides,
  };
}

describe("slowdownFraction", () => {
  it("returns 0 before onset", () => {
    const config = makeConfig({ onsetDistanceMeters: 30000 });
    expect(slowdownFraction(0, config)).toBe(0);
    expect(slowdownFraction(15000, config)).toBe(0);
    expect(slowdownFraction(29999, config)).toBe(0);
  });

  it("returns 0 at onset boundary", () => {
    const config = makeConfig({ onsetDistanceMeters: 30000 });
    expect(slowdownFraction(30000, config)).toBeCloseTo(0, 6);
  });

  it("ramps linearly from 0 to plateau", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 4000,
      plateauSlowdownFraction: 0.2,
    });
    // At midpoint of ramp: 32000m → 50% of 0.2 = 0.1
    expect(slowdownFraction(32000, config)).toBeCloseTo(0.1, 4);
    // At 25% of ramp: 31000m → 25% of 0.2 = 0.05
    expect(slowdownFraction(31000, config)).toBeCloseTo(0.05, 4);
  });

  it("returns plateau after ramp", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 3000,
      plateauSlowdownFraction: 0.15,
    });
    expect(slowdownFraction(33000, config)).toBeCloseTo(0.15, 6);
    expect(slowdownFraction(40000, config)).toBeCloseTo(0.15, 6);
  });

  it("returns 0 for none preset", () => {
    const config = makeConfig({
      preset: "none",
      plateauSlowdownFraction: 0,
    });
    expect(slowdownFraction(50000, config)).toBe(0);
  });

  it("behaves as step change when ramp is 0", () => {
    const config = makeConfig({
      onsetDistanceMeters: 30000,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0.2,
    });
    expect(slowdownFraction(29999, config)).toBe(0);
    expect(slowdownFraction(30000, config)).toBeCloseTo(0.2, 6);
    expect(slowdownFraction(30001, config)).toBeCloseTo(0.2, 6);
  });

  it("is monotonically nondecreasing", () => {
    const config = makeConfig();
    const distances = [0, 10000, 20000, 29000, 30000, 31000, 32000, 33000, 40000];
    const values = distances.map((d) => slowdownFraction(d, config));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
  });

  it("never activates when onset is beyond finish distance", () => {
    const config = makeConfig({ onsetDistanceMeters: 50000 });
    // Course is only 42km
    expect(slowdownFraction(42000, config)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/slowdown/slowdownFunction.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the core slowdown function**

```ts
// src/engine/slowdown/slowdownFunction.ts
import type { SlowdownScenarioConfig } from "./types";

export function slowdownFraction(
  cumulativeDistanceMeters: number,
  config: SlowdownScenarioConfig
): number {
  if (config.preset === "none" || config.plateauSlowdownFraction === 0) {
    return 0;
  }

  const d = cumulativeDistanceMeters;
  const dOn = config.onsetDistanceMeters;
  const dRamp = config.rampDistanceMeters;
  const sMax = config.plateauSlowdownFraction;

  if (d < dOn) return 0;
  if (dRamp === 0) return sMax;
  if (d < dOn + dRamp) return sMax * ((d - dOn) / dRamp);
  return sMax;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/engine/slowdown/slowdownFunction.test.ts`
Expected: PASS — all 8 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/engine/slowdown/types.ts src/engine/slowdown/slowdownFunction.ts tests/engine/slowdown/slowdownFunction.test.ts
git commit -m "feat: add slowdown types, presets, and core piecewise function"
```

---

### Task 9: Slowdown — overlay application and adjusted mile splits

**Files:**
- Create: `src/engine/slowdown/applySlowdown.ts`
- Create: `tests/engine/slowdown/applySlowdown.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/slowdown/applySlowdown.test.ts
import { describe, it, expect } from "vitest";
import {
  applySlowdown,
  aggregateAdjustedMileSplits,
} from "@engine/slowdown/applySlowdown";
import type { SegmentResult, MileSplit } from "@engine/types";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";
import { METERS_PER_MILE } from "@engine/utils/units";

function makeSegmentResults(count: number, distEach: number): SegmentResult[] {
  const pacePerMeter = 720 / METERS_PER_MILE; // ~12:00/mi
  let cumElapsed = 0;
  return Array.from({ length: count }, (_, i) => {
    const time = distEach * pacePerMeter;
    cumElapsed += time;
    return {
      segmentId: i,
      startDistance: i * distEach,
      endDistance: (i + 1) * distEach,
      distance: distEach,
      avgGradePct: 0,
      modelValue: 1,
      targetPaceSecPerMeter: pacePerMeter,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

function noSlowdown(): SlowdownScenarioConfig {
  return {
    preset: "none",
    mode: "forecast",
    onsetDistanceMeters: 0,
    rampDistanceMeters: 0,
    plateauSlowdownFraction: 0,
  };
}

function simpleSlowdown(): SlowdownScenarioConfig {
  return {
    preset: "custom",
    mode: "forecast",
    onsetDistanceMeters: 5000,
    rampDistanceMeters: 0,
    plateauSlowdownFraction: 0.1,
  };
}

describe("applySlowdown", () => {
  it("leaves baseline unchanged when preset is none", () => {
    const segs = makeSegmentResults(10, 1000);
    const adjusted = applySlowdown(segs, noSlowdown());
    for (let i = 0; i < adjusted.length; i++) {
      expect(adjusted[i]!.slowdownFraction).toBe(0);
      expect(adjusted[i]!.adjustedPaceSecPerMeter).toBeCloseTo(
        segs[i]!.targetPaceSecPerMeter,
        6
      );
    }
  });

  it("applies slowdown fraction after onset", () => {
    // 20 segments of 1000m each, onset at 5000m, step change 10%
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());

    // Segments before onset (midpoint < 5000) should have fraction 0
    // Segment at index 4: midpoint = 4500, before onset
    expect(adjusted[4]!.slowdownFraction).toBe(0);

    // Segment at index 5: midpoint = 5500, after onset
    expect(adjusted[5]!.slowdownFraction).toBeCloseTo(0.1, 6);

    // Segment at index 10: midpoint = 10500, after onset
    expect(adjusted[10]!.slowdownFraction).toBeCloseTo(0.1, 6);
  });

  it("adjusted finish time is slower than baseline when slowdown > 0", () => {
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());
    const baselineFinish = segs[segs.length - 1]!.cumulativeElapsedSec;
    const adjustedFinish =
      adjusted[adjusted.length - 1]!.cumulativeAdjustedElapsedSec;
    expect(adjustedFinish).toBeGreaterThan(baselineFinish);
  });

  it("cumulative adjusted elapsed is monotonically increasing", () => {
    const segs = makeSegmentResults(20, 1000);
    const adjusted = applySlowdown(segs, simpleSlowdown());
    for (let i = 1; i < adjusted.length; i++) {
      expect(
        adjusted[i]!.cumulativeAdjustedElapsedSec
      ).toBeGreaterThan(adjusted[i - 1]!.cumulativeAdjustedElapsedSec);
    }
  });
});

describe("aggregateAdjustedMileSplits", () => {
  it("produces same number of splits as baseline", () => {
    // ~5 miles of segments
    const distPerSeg = 160.934; // ~0.1 mi
    const numSegs = 50; // ~5 miles
    const segs = makeSegmentResults(numSegs, distPerSeg);
    const adjusted = applySlowdown(segs, noSlowdown());
    const baselineSplits: MileSplit[] = [
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 2, paceSecPerMile: 720, elapsedSec: 1440 },
      { mile: 3, paceSecPerMile: 720, elapsedSec: 2160 },
      { mile: 4, paceSecPerMile: 720, elapsedSec: 2880 },
      { mile: 5, paceSecPerMile: 720, elapsedSec: 3600 },
    ];

    const adjSplits = aggregateAdjustedMileSplits(segs, adjusted, baselineSplits);
    expect(adjSplits).toHaveLength(baselineSplits.length);
  });

  it("adjusted splits match baseline when no slowdown", () => {
    const distPerSeg = 160.934;
    const numSegs = 50;
    const segs = makeSegmentResults(numSegs, distPerSeg);
    const adjusted = applySlowdown(segs, noSlowdown());
    const baselineSplits: MileSplit[] = [
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 2, paceSecPerMile: 720, elapsedSec: 1440 },
      { mile: 3, paceSecPerMile: 720, elapsedSec: 2160 },
    ];

    const adjSplits = aggregateAdjustedMileSplits(segs, adjusted, baselineSplits);
    for (const split of adjSplits) {
      expect(split.adjustedPaceSecPerMile).toBeCloseTo(
        split.baselinePaceSecPerMile,
        0
      );
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/slowdown/applySlowdown.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the overlay and adjusted mile split aggregation**

```ts
// src/engine/slowdown/applySlowdown.ts
import type { SegmentResult, MileSplit } from "@engine/types";
import type {
  SlowdownScenarioConfig,
  AdjustedSegment,
  AdjustedMileSplit,
} from "./types";
import { slowdownFraction } from "./slowdownFunction";
import { METERS_PER_MILE } from "@engine/utils/units";

export function applySlowdown(
  segments: SegmentResult[],
  config: SlowdownScenarioConfig
): AdjustedSegment[] {
  let cumAdjustedElapsed = 0;

  return segments.map((seg) => {
    const midDistance = (seg.startDistance + seg.endDistance) / 2;
    const sf = slowdownFraction(midDistance, config);
    const adjustedPace = seg.targetPaceSecPerMeter * (1 + sf);
    const adjustedTime = seg.distance * adjustedPace;
    cumAdjustedElapsed += adjustedTime;

    return {
      segmentId: seg.segmentId,
      slowdownFraction: sf,
      baselinePaceSecPerMeter: seg.targetPaceSecPerMeter,
      adjustedPaceSecPerMeter: adjustedPace,
      baselineTimeSec: seg.targetTimeSec,
      adjustedTimeSec: adjustedTime,
      cumulativeAdjustedElapsedSec: cumAdjustedElapsed,
    };
  });
}

export function aggregateAdjustedMileSplits(
  baselineSegments: SegmentResult[],
  adjustedSegments: AdjustedSegment[],
  baselineSplits: MileSplit[]
): AdjustedMileSplit[] {
  if (baselineSegments.length === 0 || baselineSplits.length === 0) return [];

  const lastSeg = baselineSegments[baselineSegments.length - 1]!;
  const totalDistance = lastSeg.endDistance;

  return baselineSplits.map((baseline) => {
    const mileEndDist = baseline.mile * METERS_PER_MILE;
    let adjElapsed = 0;

    for (let i = 0; i < baselineSegments.length; i++) {
      const seg = baselineSegments[i]!;
      const adj = adjustedSegments[i]!;

      if (seg.endDistance <= mileEndDist) {
        adjElapsed = adj.cumulativeAdjustedElapsedSec;
      } else if (seg.startDistance < mileEndDist) {
        const fraction = (mileEndDist - seg.startDistance) / seg.distance;
        adjElapsed =
          adj.cumulativeAdjustedElapsedSec -
          adj.adjustedTimeSec +
          fraction * adj.adjustedTimeSec;
        break;
      } else {
        break;
      }
    }

    // If mile marker is past course end, use final adjusted time
    if (mileEndDist >= totalDistance) {
      const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
      adjElapsed = lastAdj.cumulativeAdjustedElapsedSec;
    }

    // Compute adjusted pace for this mile
    let prevAdjElapsed = 0;
    if (baseline.mile > 1) {
      // Find previous mile's adjusted elapsed
      const prevMileEndDist = (baseline.mile - 1) * METERS_PER_MILE;
      for (let i = 0; i < baselineSegments.length; i++) {
        const seg = baselineSegments[i]!;
        const adj = adjustedSegments[i]!;
        if (seg.endDistance <= prevMileEndDist) {
          prevAdjElapsed = adj.cumulativeAdjustedElapsedSec;
        } else if (seg.startDistance < prevMileEndDist) {
          const fraction =
            (prevMileEndDist - seg.startDistance) / seg.distance;
          prevAdjElapsed =
            adj.cumulativeAdjustedElapsedSec -
            adj.adjustedTimeSec +
            fraction * adj.adjustedTimeSec;
          break;
        } else {
          break;
        }
      }
    }

    const adjMileTime = adjElapsed - prevAdjElapsed;

    // Determine mile distance (partial for last mile)
    let mileDist = METERS_PER_MILE;
    const totalMiles = Math.ceil(totalDistance / METERS_PER_MILE);
    if (
      baseline.mile === totalMiles &&
      totalDistance < baseline.mile * METERS_PER_MILE
    ) {
      mileDist = totalDistance - (baseline.mile - 1) * METERS_PER_MILE;
    }

    const adjPaceSecPerMile =
      mileDist > 0 ? (adjMileTime / mileDist) * METERS_PER_MILE : 0;

    return {
      mile: baseline.mile,
      baselinePaceSecPerMile: baseline.paceSecPerMile,
      adjustedPaceSecPerMile: adjPaceSecPerMile,
      baselineElapsedSec: baseline.elapsedSec,
      adjustedElapsedSec: adjElapsed,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/slowdown/applySlowdown.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/slowdown/applySlowdown.ts tests/engine/slowdown/applySlowdown.test.ts
git commit -m "feat: add slowdown overlay application and adjusted mile split aggregation"
```

---

### Task 10: Slowdown — compensate-to-target mode

**Files:**
- Create: `src/engine/slowdown/compensate.ts`
- Create: `tests/engine/slowdown/compensate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/slowdown/compensate.test.ts
import { describe, it, expect } from "vitest";
import { compensateToTarget } from "@engine/slowdown/compensate";
import type { Microsegment } from "@engine/types";
import type { SlowdownScenarioConfig } from "@engine/slowdown/types";
import { minettiModel } from "@engine/models/minetti";

function makeFlatCourse(
  numSegments: number,
  distEach: number
): Microsegment[] {
  return Array.from({ length: numSegments }, (_, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 100,
    endElevation: 100,
    avgGradePct: 0,
  }));
}

const slowdownConfig: SlowdownScenarioConfig = {
  preset: "classic_wall",
  mode: "compensate_to_target",
  onsetDistanceMeters: 30000,
  rampDistanceMeters: 3000,
  plateauSlowdownFraction: 0.3,
};

describe("compensateToTarget", () => {
  // ~42km flat course, 263 segments of ~160m each
  const segments = makeFlatCourse(263, 160.934);
  const userTargetTimeSec = 4 * 3600; // 4 hours

  it("adjusted finish time lands close to user target", () => {
    const result = compensateToTarget(
      segments,
      minettiModel,
      userTargetTimeSec,
      slowdownConfig
    );
    expect(result.adjustedFinishTimeSec).toBeCloseTo(
      userTargetTimeSec,
      -1 // within ~10 seconds
    );
  });

  it("internal target is faster than user target when slowdown > 0", () => {
    const result = compensateToTarget(
      segments,
      minettiModel,
      userTargetTimeSec,
      slowdownConfig
    );
    expect(result.internalTargetTimeSec).toBeLessThan(userTargetTimeSec);
  });

  it("returns baseline and adjusted segments", () => {
    const result = compensateToTarget(
      segments,
      minettiModel,
      userTargetTimeSec,
      slowdownConfig
    );
    expect(result.baselineSegments).toHaveLength(segments.length);
    expect(result.adjustedSegments).toHaveLength(segments.length);
  });

  it("warns when compensation requires aggressive internal target", () => {
    const extremeConfig: SlowdownScenarioConfig = {
      preset: "custom",
      mode: "compensate_to_target",
      onsetDistanceMeters: 10000,
      rampDistanceMeters: 0,
      plateauSlowdownFraction: 0.6,
    };
    const result = compensateToTarget(
      segments,
      minettiModel,
      userTargetTimeSec,
      extremeConfig
    );
    expect(result.warning).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/slowdown/compensate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement compensate-to-target mode**

```ts
// src/engine/slowdown/compensate.ts
import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";
import type { SlowdownScenarioConfig, AdjustedSegment } from "./types";
import { solveWholeCourse } from "@engine/planner/solver";
import { applySlowdown } from "./applySlowdown";
import { bisect } from "@engine/utils/bisect";

export interface CompensateResult {
  internalTargetTimeSec: number;
  baselineSegments: SegmentResult[];
  adjustedSegments: AdjustedSegment[];
  adjustedFinishTimeSec: number;
  warning?: string;
}

export function compensateToTarget(
  microsegments: Microsegment[],
  model: PaceModel,
  userTargetTimeSec: number,
  slowdownConfig: SlowdownScenarioConfig
): CompensateResult {
  // f(T_internal) = adjustedFinishTime(T_internal) - userTarget
  // At T_internal = userTarget: adjusted > userTarget (positive, slowdown adds time)
  // At T_internal = small: adjusted < userTarget (negative, fast enough to absorb slowdown)

  const loTarget = userTargetTimeSec * 0.3; // aggressive lower bound
  const hiTarget = userTargetTimeSec; // no compensation

  function adjustedFinishForInternal(tInternal: number): number {
    const segs = solveWholeCourse(microsegments, model, tInternal);
    const adjusted = applySlowdown(segs, slowdownConfig);
    const last = adjusted[adjusted.length - 1]!;
    return last.cumulativeAdjustedElapsedSec;
  }

  let internalTargetTimeSec: number;
  try {
    internalTargetTimeSec = bisect(
      (t) => adjustedFinishForInternal(t) - userTargetTimeSec,
      loTarget,
      hiTarget,
      1.0, // 1-second tolerance is fine for race planning
      50
    );
  } catch {
    // If bisect fails (root not bracketed), the slowdown is too extreme
    // Fall back to user target with a warning
    internalTargetTimeSec = userTargetTimeSec;
  }

  const baselineSegments = solveWholeCourse(
    microsegments,
    model,
    internalTargetTimeSec
  );
  const adjustedSegments = applySlowdown(baselineSegments, slowdownConfig);
  const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
  const adjustedFinishTimeSec = lastAdj.cumulativeAdjustedElapsedSec;

  // Warn if compensation is extreme (internal target < 80% of user target)
  let warning: string | undefined;
  if (internalTargetTimeSec < userTargetTimeSec * 0.8) {
    warning = `Compensating for this slowdown requires a very aggressive internal pace plan (${Math.round((1 - internalTargetTimeSec / userTargetTimeSec) * 100)}% faster than your target). Consider a milder slowdown scenario.`;
  }

  return {
    internalTargetTimeSec,
    baselineSegments,
    adjustedSegments,
    adjustedFinishTimeSec,
    warning,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/slowdown/compensate.test.ts`
Expected: PASS — all 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/slowdown/compensate.ts tests/engine/slowdown/compensate.test.ts
git commit -m "feat: add slowdown compensate-to-target mode with bisection solver"
```

---

### Task 11: Slowdown — pipeline integration and UI

**Files:**
- Modify: `src/engine/planner/pipeline.ts`
- Modify: `src/engine/types.ts`
- Create: `src/ui/components/SlowdownControls.tsx`
- Create: `src/ui/components/SlowdownSplitsTable.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add slowdown fields to `PlannerInput` and `RacePlan`**

In `src/engine/types.ts`, add to `PlannerInput`:

```ts
  /** Slowdown scenario preset. If omitted, no slowdown is applied. */
  slowdownPreset?: import("@engine/slowdown/types").SlowdownPreset;
  slowdownMode?: import("@engine/slowdown/types").SlowdownMode;
  /** Custom slowdown parameters (when preset is "custom") */
  slowdownOnsetMeters?: number;
  slowdownRampMeters?: number;
  slowdownPlateauFraction?: number;
```

Add to `RacePlan`:

```ts
  slowdown?: import("@engine/slowdown/types").SlowdownResult;
```

Note: Import the slowdown types directly — there are no circular dependencies since `types.ts` doesn't import from the engine. Use `import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";` at the top of `types.ts`, or inline the string literal types directly in the `PlannerInput` fields (e.g., `slowdownPreset?: "none" | "controlled_late_fade" | ...`). The direct import approach is cleaner.

- [ ] **Step 2: Integrate slowdown into pipeline**

In `src/engine/planner/pipeline.ts`, add imports:

```ts
import { resolveSlowdownConfig } from "@engine/slowdown/types";
import { applySlowdown, aggregateAdjustedMileSplits } from "@engine/slowdown/applySlowdown";
import { compensateToTarget } from "@engine/slowdown/compensate";
```

After computing `mileSplits` and `climbs`, add slowdown processing:

```ts
  // 9. Apply slowdown if configured
  let slowdownResult: SlowdownResult | undefined;

  if (input.slowdownPreset && input.slowdownPreset !== "none") {
    const sdMode = input.slowdownMode ?? "forecast";
    const sdConfig = resolveSlowdownConfig(
      input.slowdownPreset,
      sdMode,
      {
        onsetDistanceMeters: input.slowdownOnsetMeters,
        rampDistanceMeters: input.slowdownRampMeters,
        plateauSlowdownFraction: input.slowdownPlateauFraction,
      }
    );

    // Warn if onset is beyond course length
    const courseLengthMeters = microsegments[microsegments.length - 1]!.endDistance;
    if (sdConfig.onsetDistanceMeters > courseLengthMeters) {
      warnings.push(
        `Slowdown onset (${(sdConfig.onsetDistanceMeters / 1000).toFixed(1)} km) is beyond course length (${(courseLengthMeters / 1000).toFixed(1)} km). Slowdown will not activate.`
      );
    }

    // Warn if preset is designed for marathons but course is short
    const wallPresets = ["wall_lite", "classic_wall", "early_blowup"];
    if (
      wallPresets.includes(sdConfig.preset) &&
      courseLengthMeters < 20000
    ) {
      warnings.push(
        `The "${sdConfig.preset}" slowdown preset is designed for marathon-distance courses and may not be meaningful for a ${(courseLengthMeters / 1000).toFixed(1)} km course.`
      );
    }

    if (sdMode === "compensate_to_target" && mode === "target_time") {
      const compResult = compensateToTarget(
        microsegments,
        model,
        targetTimeSec,
        sdConfig
      );
      if (compResult.warning) warnings.push(compResult.warning);

      // Replace baseline segments with the compensated ones
      segmentResults = compResult.baselineSegments;
      mileSplits = aggregateMileSplits(segmentResults);

      const adjMileSplits = aggregateAdjustedMileSplits(
        segmentResults,
        compResult.adjustedSegments,
        mileSplits
      );

      slowdownResult = {
        config: sdConfig,
        baselineFinishTimeSec: segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec,
        adjustedFinishTimeSec: compResult.adjustedFinishTimeSec,
        slowdownCostSec: compResult.adjustedFinishTimeSec - segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec,
        adjustedSegments: compResult.adjustedSegments,
        adjustedMileSplits: adjMileSplits,
        internalTargetTimeSec: compResult.internalTargetTimeSec,
      };
    } else {
      // Forecast mode (or target_effort mode)
      const adjustedSegments = applySlowdown(segmentResults, sdConfig);
      const adjMileSplits = aggregateAdjustedMileSplits(
        segmentResults,
        adjustedSegments,
        mileSplits
      );

      const lastAdj = adjustedSegments[adjustedSegments.length - 1]!;
      const baselineFinish = segmentResults[segmentResults.length - 1]!.cumulativeElapsedSec;

      slowdownResult = {
        config: sdConfig,
        baselineFinishTimeSec: baselineFinish,
        adjustedFinishTimeSec: lastAdj.cumulativeAdjustedElapsedSec,
        slowdownCostSec: lastAdj.cumulativeAdjustedElapsedSec - baselineFinish,
        adjustedSegments,
        adjustedMileSplits: adjMileSplits,
      };
    }
  }
```

Update the return:

```ts
  return {
    summary,
    segments: segmentResults,
    mileSplits,
    climbs,
    slowdown: slowdownResult,
    warnings,
  };
```

Note: `segmentResults` and `mileSplits` need to be declared with `let` instead of `const` since compensate mode reassigns them.

- [ ] **Step 3: Create SlowdownControls component**

```tsx
// src/ui/components/SlowdownControls.tsx
import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";
import { SLOWDOWN_PRESET_LABELS } from "@engine/slowdown/types";

interface SlowdownControlsProps {
  preset: SlowdownPreset;
  onPresetChange: (preset: SlowdownPreset) => void;
  mode: SlowdownMode;
  onModeChange: (mode: SlowdownMode) => void;
  customOnsetKm: string;
  onCustomOnsetKmChange: (value: string) => void;
  customRampKm: string;
  onCustomRampKmChange: (value: string) => void;
  customPlateauPct: string;
  onCustomPlateauPctChange: (value: string) => void;
}

const presetKeys: SlowdownPreset[] = [
  "none",
  "controlled_late_fade",
  "gentle_late_fade",
  "moderate_late_fade",
  "wall_lite",
  "classic_wall",
  "early_blowup",
  "custom",
];

export function SlowdownControls({
  preset,
  onPresetChange,
  mode,
  onModeChange,
  customOnsetKm,
  onCustomOnsetKmChange,
  customRampKm,
  onCustomRampKmChange,
  customPlateauPct,
  onCustomPlateauPctChange,
}: SlowdownControlsProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>Slowdown Scenario</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="slowdown-preset">Scenario</label>
          <select
            id="slowdown-preset"
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as SlowdownPreset)}
          >
            {presetKeys.map((k) => (
              <option key={k} value={k}>
                {SLOWDOWN_PRESET_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {preset !== "none" && (
          <div className="form-group">
            <label htmlFor="slowdown-mode">Mode</label>
            <select
              id="slowdown-mode"
              value={mode}
              onChange={(e) => onModeChange(e.target.value as SlowdownMode)}
            >
              <option value="forecast">Forecast</option>
              <option value="compensate_to_target">Compensate to target</option>
            </select>
          </div>
        )}
      </div>

      {preset === "custom" && (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="custom-onset">Onset (km)</label>
            <input
              id="custom-onset"
              type="text"
              value={customOnsetKm}
              onChange={(e) => onCustomOnsetKmChange(e.target.value)}
              placeholder="30"
              style={{ width: "80px" }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="custom-ramp">Ramp (km)</label>
            <input
              id="custom-ramp"
              type="text"
              value={customRampKm}
              onChange={(e) => onCustomRampKmChange(e.target.value)}
              placeholder="3"
              style={{ width: "80px" }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="custom-plateau">Plateau (%)</label>
            <input
              id="custom-plateau"
              type="text"
              value={customPlateauPct}
              onChange={(e) => onCustomPlateauPctChange(e.target.value)}
              placeholder="10"
              style={{ width: "80px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create SlowdownSplitsTable component**

```tsx
// src/ui/components/SlowdownSplitsTable.tsx
import type { AdjustedMileSplit } from "@engine/slowdown/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

interface SlowdownSplitsTableProps {
  splits: AdjustedMileSplit[];
}

export function SlowdownSplitsTable({ splits }: SlowdownSplitsTableProps) {
  return (
    <div>
      <h2>Baseline vs Adjusted Splits</h2>
      <table>
        <thead>
          <tr>
            <th>Mile</th>
            <th>Baseline Pace</th>
            <th>Adjusted Pace</th>
            <th>Baseline Elapsed</th>
            <th>Adjusted Elapsed</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={split.mile}>
              <td>{split.mile}</td>
              <td>{formatPace(split.baselinePaceSecPerMile)} /mi</td>
              <td>{formatPace(split.adjustedPaceSecPerMile)} /mi</td>
              <td>{formatElapsedTime(split.baselineElapsedSec)}</td>
              <td>{formatElapsedTime(split.adjustedElapsedSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Wire slowdown into App.tsx**

Add state variables in `App`:

```tsx
  const [slowdownPreset, setSlowdownPreset] = useState<SlowdownPreset>("none");
  const [slowdownMode, setSlowdownMode] = useState<SlowdownMode>("forecast");
  const [customOnsetKm, setCustomOnsetKm] = useState("30");
  const [customRampKm, setCustomRampKm] = useState("3");
  const [customPlateauPct, setCustomPlateauPct] = useState("10");
```

Add imports at top of `App.tsx`:

```tsx
import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";
import { SlowdownControls } from "@ui/components/SlowdownControls";
import { SlowdownSplitsTable } from "@ui/components/SlowdownSplitsTable";
```

Pass slowdown params in `handleRun` when building the input:

```tsx
        slowdownPreset: slowdownPreset !== "none" ? slowdownPreset : undefined,
        slowdownMode,
        slowdownOnsetMeters:
          slowdownPreset === "custom"
            ? parseFloat(customOnsetKm) * 1000
            : undefined,
        slowdownRampMeters:
          slowdownPreset === "custom"
            ? parseFloat(customRampKm) * 1000
            : undefined,
        slowdownPlateauFraction:
          slowdownPreset === "custom"
            ? parseFloat(customPlateauPct) / 100
            : undefined,
```

Add `SlowdownControls` to the form area (after `PlannerForm`, before the Generate button area — or after the PlannerForm component):

```tsx
      <SlowdownControls
        preset={slowdownPreset}
        onPresetChange={setSlowdownPreset}
        mode={slowdownMode}
        onModeChange={setSlowdownMode}
        customOnsetKm={customOnsetKm}
        onCustomOnsetKmChange={setCustomOnsetKm}
        customRampKm={customRampKm}
        onCustomRampKmChange={setCustomRampKm}
        customPlateauPct={customPlateauPct}
        onCustomPlateauPctChange={setCustomPlateauPct}
      />
```

Ensure `formatElapsedTime` is imported in `App.tsx` (it's already available from `@engine/utils/paceFormatting` — add to the existing import if not already there).

Add `SlowdownSplitsTable` in the output area:

```tsx
          {plan.slowdown && (
            <>
              <div className="summary-grid" style={{ marginTop: "1rem" }}>
                <dt>Baseline finish</dt>
                <dd>{formatElapsedTime(plan.slowdown.baselineFinishTimeSec)}</dd>
                <dt>Adjusted finish</dt>
                <dd>{formatElapsedTime(plan.slowdown.adjustedFinishTimeSec)}</dd>
                <dt>Slowdown cost</dt>
                <dd>+{formatElapsedTime(plan.slowdown.slowdownCostSec)}</dd>
              </div>
              <SlowdownSplitsTable splits={plan.slowdown.adjustedMileSplits} />
            </>
          )}
```

Add the slowdown state variables to the `handleRun` dependency array.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/planner/pipeline.ts src/ui/components/SlowdownControls.tsx src/ui/components/SlowdownSplitsTable.tsx src/App.tsx
git commit -m "feat: integrate slowdown scenarios into pipeline and UI"
```

---

### Task 12: Export — CSV, JSON, tattoo format, and UI

**Files:**
- Create: `src/engine/export/csvExport.ts`
- Create: `src/engine/export/tattooFormat.ts`
- Create: `tests/engine/export/csvExport.test.ts`
- Create: `tests/engine/export/tattooFormat.test.ts`
- Create: `src/ui/components/ExportControls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing tests for CSV export**

```ts
// tests/engine/export/csvExport.test.ts
import { describe, it, expect } from "vitest";
import { racePlanToCsv } from "@engine/export/csvExport";
import type { RacePlan, MileSplit, PlanSummary, ClimbSegment } from "@engine/types";

function makePlan(splits: MileSplit[]): RacePlan {
  const summary: PlanSummary = {
    planningMode: "target_time",
    modelId: "test",
    modelLabel: "Test Model",
    targetFinishTimeSec: 3600,
    computedFinishTimeSec: 3600,
    courseLengthMeters: 16093.44,
    totalClimbMeters: 100,
    totalDescentMeters: 100,
    flatEquivalentPaceSecPerMile: 360,
    weightedDistanceMeters: 16093.44,
  };

  return {
    summary,
    segments: [],
    mileSplits: splits,
    climbs: [],
    warnings: [],
  };
}

describe("racePlanToCsv", () => {
  it("produces header row and data rows", () => {
    const plan = makePlan([
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
      { mile: 2, paceSecPerMile: 750, elapsedSec: 1470 },
    ]);
    const csv = racePlanToCsv(plan);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Mile,Pace (/mi),Elapsed Time");
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it("formats pace as mm:ss", () => {
    const plan = makePlan([
      { mile: 1, paceSecPerMile: 720, elapsedSec: 720 },
    ]);
    const csv = racePlanToCsv(plan);
    expect(csv).toContain("12:00");
  });

  it("returns empty CSV for no splits", () => {
    const plan = makePlan([]);
    const csv = racePlanToCsv(plan);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1); // header only
  });
});
```

- [ ] **Step 2: Write the failing tests for tattoo format**

```ts
// tests/engine/export/tattooFormat.test.ts
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
    // Line 1 should contain mile 1, pace 12:00, elapsed 0:12:00 or 12:00
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/export/`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement CSV export**

```ts
// src/engine/export/csvExport.ts
import type { RacePlan } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

export function racePlanToCsv(plan: RacePlan): string {
  const header = "Mile,Pace (/mi),Elapsed Time";
  const rows = plan.mileSplits.map(
    (s) =>
      `${s.mile},${formatPace(s.paceSecPerMile)},${formatElapsedTime(s.elapsedSec)}`
  );
  return [header, ...rows].join("\n");
}

export function racePlanToJson(plan: RacePlan): string {
  return JSON.stringify(
    {
      summary: plan.summary,
      mileSplits: plan.mileSplits,
      climbs: plan.climbs,
      warnings: plan.warnings,
    },
    null,
    2
  );
}
```

- [ ] **Step 5: Implement tattoo format**

```ts
// src/engine/export/tattooFormat.ts
import type { MileSplit } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

export function racePlanToTattoo(splits: MileSplit[]): string {
  // Determine max mile number width for alignment
  const maxMile = splits.length > 0 ? splits[splits.length - 1]!.mile : 0;
  const mileWidth = String(maxMile).length;

  return splits
    .map((s) => {
      const mileStr = String(s.mile).padStart(mileWidth);
      const pace = formatPace(s.paceSecPerMile);
      const elapsed = formatElapsedTime(s.elapsedSec);
      return `${mileStr}  ${pace}  ${elapsed}`;
    })
    .join("\n");
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/export/`
Expected: PASS — all 7 tests pass

- [ ] **Step 7: Create ExportControls component**

```tsx
// src/ui/components/ExportControls.tsx
import type { RacePlan } from "@engine/types";
import { racePlanToCsv, racePlanToJson } from "@engine/export/csvExport";
import { racePlanToTattoo } from "@engine/export/tattooFormat";
import { useState } from "react";

interface ExportControlsProps {
  plan: RacePlan;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportControls({ plan }: ExportControlsProps) {
  const [showTattoo, setShowTattoo] = useState(false);

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2>Export</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => downloadBlob(racePlanToCsv(plan), "race-plan.csv", "text/csv")}
        >
          Download CSV
        </button>
        <button
          onClick={() =>
            downloadBlob(racePlanToJson(plan), "race-plan.json", "application/json")
          }
        >
          Download JSON
        </button>
        <button onClick={() => setShowTattoo((prev) => !prev)}>
          {showTattoo ? "Hide" : "Show"} Wristband Format
        </button>
      </div>

      {showTattoo && (
        <pre
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            overflowX: "auto",
          }}
        >
          {racePlanToTattoo(plan.mileSplits)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Wire ExportControls into App.tsx**

Add the import:

```tsx
import { ExportControls } from "@ui/components/ExportControls";
```

In the render, add after the climb table (or after slowdown table if present):

```tsx
          <ExportControls plan={plan} />
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add src/engine/export/csvExport.ts src/engine/export/tattooFormat.ts tests/engine/export/csvExport.test.ts tests/engine/export/tattooFormat.test.ts src/ui/components/ExportControls.tsx src/App.tsx
git commit -m "feat: add CSV/JSON/tattoo export with download controls"
```

---

## Dependency graph

```
Task 1 (Ultrapacer) ──────────────────────────────┐
Task 2 (Personal calibration) ────────────────────┤
Task 3 (Target effort types & solver) ─── Task 4 ─── Task 5 (UI)
Task 6 (Climb detection) ─── Task 7 (Climb UI + pipeline)
Task 8 (Slowdown core) ─── Task 9 (Overlay) ─── Task 10 (Compensate) ─── Task 11 (Pipeline + UI)
Task 12 (Export) ─── depends on RacePlan shape from Tasks 7 and 11
```

**Parallelizable groups:**
- Tasks 1, 2 can run in parallel (independent models)
- Tasks 3-5 (target effort) are sequential but independent of Tasks 1-2
- Tasks 6-7 (climb) are independent of Tasks 1-5
- Tasks 8-11 (slowdown) are sequential but independent of Tasks 1-7
- Task 12 (export) should run last since it depends on the final `RacePlan` shape

**Recommended execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
