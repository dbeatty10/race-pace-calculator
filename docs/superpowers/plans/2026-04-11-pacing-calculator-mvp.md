# Pacing Calculator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a race-plan calculator that generates equal-effort pacing plans for hilly courses, with a web UI for uploading GPX files, selecting hill models, and viewing mile-by-mile splits.

**Architecture:** Pure TypeScript engine (course parsing, hill models, solver, aggregation) with zero UI dependencies, wrapped in a thin Vite + React SPA. All computation runs client-side in the browser. The engine is designed around a pluggable `PaceModel` interface that supports direct-multiplier, demand-model, and interpolation model kinds — MVP implements one of each.

**Tech Stack:** TypeScript 5, Vite 6, React 19, Vitest 3 (jsdom environment)

---

## File Structure

```
race-pace-calculator/
  package.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    App.css
    engine/
      types.ts                    # All shared types (CoursePoint, Microsegment, PaceModel, etc.)
      course/
        parseGpx.ts               # GPX XML → RawTrackPoint[]
        haversine.ts              # Haversine distance helper
        smoothElevation.ts        # Moving-average elevation smoother
        resampleCourse.ts         # Even-distance resampling → Microsegment[]
      models/
        minetti.ts                # Minetti direct multiplier
        stravaInferred.ts         # Strava GAP user-inferred interpolation
        re3.ts                    # Updated RE3 demand model
        registry.ts               # Model registry: getModel(), listModels()
      planner/
        solver.ts                 # Whole-course solver (both paths)
        aggregateMiles.ts         # Segment results → mile splits
        summary.ts                # Compute plan summary stats
        pipeline.ts               # Top-level generateRacePlan()
      utils/
        bisect.ts                 # Monotone bisection root finder
        interpolation.ts          # Linear interpolation helper
        units.ts                  # Speed/pace conversions
        paceFormatting.ts         # Format pace strings, parse target time
    ui/
      components/
        CourseUpload.tsx           # GPX file upload
        PlannerForm.tsx            # Model selection, target time, run button
        SummaryPanel.tsx           # Plan summary display
        MileSplitsTable.tsx        # Mile-by-mile results table
  tests/
    engine/
      utils/
        bisect.test.ts
        interpolation.test.ts
        units.test.ts
        paceFormatting.test.ts
      models/
        minetti.test.ts
        stravaInferred.test.ts
        re3.test.ts
        registry.test.ts
      course/
        parseGpx.test.ts
        haversine.test.ts
        smoothElevation.test.ts
        resampleCourse.test.ts
      planner/
        solver.test.ts
        aggregateMiles.test.ts
        summary.test.ts
        pipeline.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript vitest jsdom @types/react @types/react-dom
```

- [ ] **Step 2: Create tsconfig.json**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@engine/*": ["./src/engine/*"],
      "@ui/*": ["./src/ui/*"]
    },
    "baseUrl": "."
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

Write `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

Write `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@engine": path.resolve(__dirname, "src/engine"),
      "@ui": path.resolve(__dirname, "src/ui"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

- [ ] **Step 5: Create index.html**

Write `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Race Plan Calculator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/main.tsx and src/App.tsx**

Write `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Write `src/App.tsx`:

```tsx
export default function App() {
  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>
      <p>Upload a GPX file to get started.</p>
    </div>
  );
}
```

Write `src/App.css`:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
  color: #1a1a1a;
}

h1 {
  margin-bottom: 0.5rem;
}

h2 {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 0.5rem;
}

th, td {
  border: 1px solid #ddd;
  padding: 0.4rem 0.6rem;
  text-align: right;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

td:first-child, th:first-child {
  text-align: left;
}

input, select, button {
  font-size: 1rem;
  padding: 0.4rem 0.6rem;
}

button {
  cursor: pointer;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
}

button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.form-row {
  display: flex;
  gap: 1rem;
  align-items: end;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
}

.summary-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  margin: 0.5rem 0;
}

.summary-grid dt {
  font-weight: 600;
}

.warning {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}
```

- [ ] **Step 7: Verify build and dev server**

Run: `npx vite build`
Expected: Build completes without errors.

Run: `npx vite --host --port 5173 &` and then `curl -s http://localhost:5173 | head -20`
Expected: HTML response containing "Race Plan Calculator". Kill the dev server afterward.

- [ ] **Step 8: Verify vitest runs**

Write a trivial test file `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run`
Expected: 1 test passes.

Delete `tests/smoke.test.ts` after confirming.

- [ ] **Step 9: Commit**

```bash
git init
echo 'node_modules\ndist' > .gitignore
git add .
git commit -m "feat: scaffold Vite + React + TypeScript project with vitest"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 1: Write all shared engine types**

Write `src/engine/types.ts`:

```ts
// ── Course types ──

export interface RawTrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface CoursePoint {
  /** Cumulative distance from start in meters */
  distance: number;
  /** Elevation in meters */
  elevation: number;
}

export interface Microsegment {
  startDistance: number;
  endDistance: number;
  distance: number;
  startElevation: number;
  endElevation: number;
  avgGradePct: number;
}

// ── Model types ──

export type ModelKind =
  | "direct_multiplier"
  | "demand_model"
  | "interpolation_model"
  | "proprietary_unavailable";

export type Provenance =
  | "official"
  | "paper"
  | "source-code"
  | "user-inferred"
  | "reconstructed"
  | "proprietary";

export interface PaceModelContext {
  refFlatSpeedMps?: number;
}

export interface PaceModel {
  id: string;
  label: string;
  kind: ModelKind;
  provenance: Provenance;
  gradePctMin: number;
  gradePctMax: number;
  supportsDownhill: boolean;
  notes: string;
  warning?: string;

  /**
   * For direct_multiplier and interpolation_model kinds.
   * Returns multiplier M such that hillPace = flatPace * M.
   * M(0) should be ~1.0 for normalized models.
   */
  multiplier?: (gradePct: number, ctx?: PaceModelContext) => number;

  /**
   * For demand_model kinds.
   * Given a flat-equivalent speed (m/s) and grade (%),
   * returns the hill speed (m/s) that produces equal effort.
   */
  hillSpeedFromFlatSpeed?: (
    flatSpeedMps: number,
    gradePct: number,
    ctx?: PaceModelContext
  ) => number;
}

// ── Planner types ──

export interface SegmentResult {
  segmentId: number;
  startDistance: number;
  endDistance: number;
  distance: number;
  avgGradePct: number;
  modelValue: number;
  targetPaceSecPerMeter: number;
  targetTimeSec: number;
  cumulativeElapsedSec: number;
}

export interface MileSplit {
  mile: number;
  paceSecPerMile: number;
  elapsedSec: number;
}

export interface PlanSummary {
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

export interface RacePlan {
  summary: PlanSummary;
  segments: SegmentResult[];
  mileSplits: MileSplit[];
  warnings: string[];
}

// ── Pipeline input ──

export type SmoothingLevel = "none" | "light" | "medium" | "heavy";

export interface PlannerInput {
  gpxData: string;
  targetFinishTimeSec: number;
  modelId: string;
  segmentDistanceMeters?: number;
  smoothing?: SmoothingLevel;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add core engine type definitions"
```

---

## Task 3: Bisect Utility

**Files:**
- Create: `src/engine/utils/bisect.ts`
- Create: `tests/engine/utils/bisect.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/utils/bisect.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { bisect } from "@engine/utils/bisect";

describe("bisect", () => {
  it("finds the root of x^2 - 4 near x=2", () => {
    const root = bisect((x) => x * x - 4, 0, 5);
    expect(root).toBeCloseTo(2, 5);
  });

  it("finds the root of x^2 - 4 near x=-2", () => {
    const root = bisect((x) => x * x - 4, -5, 0);
    expect(root).toBeCloseTo(-2, 5);
  });

  it("returns exact root when landed on", () => {
    const root = bisect((x) => x - 3, 0, 6);
    expect(root).toBeCloseTo(3, 5);
  });

  it("throws when root is not bracketed", () => {
    expect(() => bisect((x) => x * x + 1, 0, 5)).toThrow("Root not bracketed");
  });

  it("respects tolerance", () => {
    const root = bisect((x) => x - Math.PI, 3, 4, 1e-10);
    expect(Math.abs(root - Math.PI)).toBeLessThan(1e-10);
  });

  it("returns lo if f(lo) is zero", () => {
    const root = bisect((x) => x - 2, 2, 5);
    expect(root).toBe(2);
  });

  it("returns hi if f(hi) is zero", () => {
    const root = bisect((x) => x - 5, 2, 5);
    expect(root).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/utils/bisect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement bisect**

Write `src/engine/utils/bisect.ts`:

```ts
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-9,
  maxIter = 100
): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);

  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) throw new Error("Root not bracketed");

  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);

    if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m;

    if (fa * fm <= 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }

  return 0.5 * (a + b);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/utils/bisect.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/utils/bisect.ts tests/engine/utils/bisect.test.ts
git commit -m "feat: add bisect root-finding utility with tests"
```

---

## Task 4: Interpolation Utility

**Files:**
- Create: `src/engine/utils/interpolation.ts`
- Create: `tests/engine/utils/interpolation.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/utils/interpolation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/utils/interpolation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement interp1d**

Write `src/engine/utils/interpolation.ts`:

```ts
export function interp1d(points: [number, number][], x: number): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);

  if (x <= sorted[0][0]) return sorted[0][1];
  if (x >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];

  for (let i = 1; i < sorted.length; i++) {
    const [x1, y1] = sorted[i - 1];
    const [x2, y2] = sorted[i];
    if (x <= x2) {
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }

  // Should never reach here if input is valid
  return sorted[sorted.length - 1][1];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/utils/interpolation.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/utils/interpolation.ts tests/engine/utils/interpolation.test.ts
git commit -m "feat: add linear interpolation utility with tests"
```

---

## Task 5: Unit Conversions and Pace Formatting

**Files:**
- Create: `src/engine/utils/units.ts`
- Create: `src/engine/utils/paceFormatting.ts`
- Create: `tests/engine/utils/units.test.ts`
- Create: `tests/engine/utils/paceFormatting.test.ts`

- [ ] **Step 1: Write failing unit conversion tests**

Write `tests/engine/utils/units.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing pace formatting tests**

Write `tests/engine/utils/paceFormatting.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/utils/units.test.ts tests/engine/utils/paceFormatting.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement unit conversions**

Write `src/engine/utils/units.ts`:

```ts
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

export function speedMpsToPaceSecPerMile(speedMps: number): number {
  return METERS_PER_MILE / speedMps;
}

export function paceSecPerMileToSpeedMps(paceSecPerMile: number): number {
  return METERS_PER_MILE / paceSecPerMile;
}

export function speedMpsToPaceSecPerKm(speedMps: number): number {
  return 1000 / speedMps;
}

export function paceSecPerKmToSpeedMps(paceSecPerKm: number): number {
  return 1000 / paceSecPerKm;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersToFeet(meters: number): number {
  return meters * FEET_PER_METER;
}

export { METERS_PER_MILE };
```

- [ ] **Step 5: Implement pace formatting**

Write `src/engine/utils/paceFormatting.ts`:

```ts
export function formatPace(secPerMile: number): string {
  const totalSec = Math.round(secPerMile);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatElapsedTime(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTargetTime(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty target time");

  const parts = trimmed.split(":");

  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (isNaN(h) || isNaN(m) || isNaN(s)) throw new Error(`Invalid time: ${input}`);
    return h * 3600 + m * 60 + s;
  }

  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) throw new Error(`Invalid time: ${input}`);
    return h * 3600 + m * 60;
  }

  if (parts.length === 1) {
    const minutes = parseFloat(trimmed);
    if (isNaN(minutes)) throw new Error(`Invalid time: ${input}`);
    return minutes * 60;
  }

  throw new Error(`Invalid time format: ${input}`);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/utils/`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/utils/units.ts src/engine/utils/paceFormatting.ts tests/engine/utils/units.test.ts tests/engine/utils/paceFormatting.test.ts
git commit -m "feat: add unit conversions and pace formatting utilities with tests"
```

---

## Task 6: Minetti Hill Model

**Files:**
- Create: `src/engine/models/minetti.ts`
- Create: `tests/engine/models/minetti.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/models/minetti.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { minettiModel } from "@engine/models/minetti";

describe("minettiModel", () => {
  const mult = minettiModel.multiplier!;

  it("has correct metadata", () => {
    expect(minettiModel.id).toBe("minetti");
    expect(minettiModel.kind).toBe("direct_multiplier");
    expect(minettiModel.provenance).toBe("paper");
    expect(minettiModel.supportsDownhill).toBe(true);
  });

  it("returns 1.0 on flat", () => {
    expect(mult(0)).toBeCloseTo(1.0, 6);
  });

  it("returns > 1 on uphill", () => {
    expect(mult(5)).toBeGreaterThan(1);
    expect(mult(10)).toBeGreaterThan(1);
    expect(mult(20)).toBeGreaterThan(1);
  });

  it("uphill is monotone increasing for positive grades", () => {
    const grades = [0, 2, 5, 8, 10, 15, 20];
    for (let i = 1; i < grades.length; i++) {
      expect(mult(grades[i])).toBeGreaterThan(mult(grades[i - 1]));
    }
  });

  it("returns < 1 on moderate downhills", () => {
    expect(mult(-5)).toBeLessThan(1);
    expect(mult(-10)).toBeLessThan(1);
  });

  it("shows U-shape: steep downhill is harder than moderate downhill", () => {
    // Multiplier should decrease then increase as downhill gets steeper
    const m5 = mult(-5);
    const m10 = mult(-10);
    const m20 = mult(-20);
    expect(m10).toBeLessThan(m5);
    expect(m20).toBeGreaterThan(m10);
  });

  it("returns finite values across declared range", () => {
    for (let g = minettiModel.gradePctMin; g <= minettiModel.gradePctMax; g += 1) {
      expect(Number.isFinite(mult(g))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/minetti.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Minetti model**

Write `src/engine/models/minetti.ts`:

```ts
import type { PaceModel } from "@engine/types";

function minettiCr(gradePct: number): number {
  const g = gradePct / 100;
  return (
    155.4 * g ** 5 -
    30.4 * g ** 4 -
    43.3 * g ** 3 +
    46.3 * g ** 2 +
    19.5 * g +
    3.6
  );
}

const CR_FLAT = 3.6;

function minettiMultiplier(gradePct: number): number {
  return minettiCr(gradePct) / CR_FLAT;
}

export const minettiModel: PaceModel = {
  id: "minetti",
  label: "Minetti",
  kind: "direct_multiplier",
  provenance: "paper",
  gradePctMin: -40,
  gradePctMax: 40,
  supportsDownhill: true,
  notes:
    "Classic metabolic-cost model. Tends to over-credit steep downhills for real-world racing.",
  multiplier: minettiMultiplier,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/minetti.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/models/minetti.ts tests/engine/models/minetti.test.ts
git commit -m "feat: add Minetti hill model with tests"
```

---

## Task 7: Strava GAP Inferred Model

**Files:**
- Create: `src/engine/models/stravaInferred.ts`
- Create: `tests/engine/models/stravaInferred.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/models/stravaInferred.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stravaInferredModel } from "@engine/models/stravaInferred";

describe("stravaInferredModel", () => {
  const mult = stravaInferredModel.multiplier!;

  it("has correct metadata", () => {
    expect(stravaInferredModel.id).toBe("strava_inferred");
    expect(stravaInferredModel.kind).toBe("interpolation_model");
    expect(stravaInferredModel.provenance).toBe("user-inferred");
    expect(stravaInferredModel.supportsDownhill).toBe(true);
    expect(stravaInferredModel.warning).toBeDefined();
  });

  it("returns ~1.0 at flat", () => {
    expect(mult(0)).toBeCloseTo(1.0, 1);
  });

  it("returns ~0.88 around -9% to -10%", () => {
    const m = mult(-10);
    expect(m).toBeGreaterThan(0.83);
    expect(m).toBeLessThan(0.93);
  });

  it("returns ~1.0 around -18%", () => {
    const m = mult(-18);
    expect(m).toBeGreaterThan(0.95);
    expect(m).toBeLessThan(1.10);
  });

  it("returns > 1 on uphill", () => {
    expect(mult(5)).toBeGreaterThan(1);
    expect(mult(10)).toBeGreaterThan(1);
  });

  it("uphill is monotone increasing for positive grades", () => {
    const grades = [0, 2, 5, 8, 10, 15, 20];
    for (let i = 1; i < grades.length; i++) {
      expect(mult(grades[i])).toBeGreaterThan(mult(grades[i - 1]));
    }
  });

  it("uses fallback quadratic outside data range", () => {
    const m25 = mult(25);
    // Fallback: 1 + 0.029*25 + 0.0015*25^2 = 1 + 0.725 + 0.9375 = 2.6625
    expect(m25).toBeCloseTo(2.6625, 2);
  });

  it("returns finite values across a wide range", () => {
    for (let g = -30; g <= 30; g += 1) {
      expect(Number.isFinite(mult(g))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/stravaInferred.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Strava inferred model**

Write `src/engine/models/stravaInferred.ts`:

```ts
import type { PaceModel } from "@engine/types";
import { interp1d } from "@engine/utils/interpolation";

/**
 * User-inferred data points digitized from publicly visible Strava GAP curves.
 * NOT the official Strava production formula.
 *
 * Format: [gradePct, multiplier]
 * Multiplier is relative to flat (1.0 = same as flat).
 */
export const STRAVA_INFERRED_POINTS: [number, number][] = [
  [-20, 1.10],
  [-18, 1.00],
  [-15, 0.92],
  [-12, 0.88],
  [-10, 0.87],
  [-8, 0.88],
  [-6, 0.90],
  [-4, 0.93],
  [-2, 0.96],
  [0, 1.00],
  [2, 1.07],
  [4, 1.15],
  [6, 1.25],
  [8, 1.37],
  [10, 1.50],
  [12, 1.68],
  [15, 2.02],
  [18, 2.42],
  [20, 2.80],
];

function stravaInferredMultiplier(gradePct: number): number {
  const minX = STRAVA_INFERRED_POINTS[0][0]; // -20
  const maxX = STRAVA_INFERRED_POINTS[STRAVA_INFERRED_POINTS.length - 1][0]; // 20

  if (gradePct >= minX && gradePct <= maxX) {
    return interp1d(STRAVA_INFERRED_POINTS, gradePct);
  }

  // Fallback quadratic outside data range
  return 1 + 0.029 * gradePct + 0.0015 * gradePct ** 2;
}

export const stravaInferredModel: PaceModel = {
  id: "strava_inferred",
  label: "Strava GAP (user-inferred)",
  kind: "interpolation_model",
  provenance: "user-inferred",
  gradePctMin: -20,
  gradePctMax: 20,
  supportsDownhill: true,
  notes:
    "User-inferred approximation from digitized public graph data. Uses fallback quadratic outside data range.",
  warning:
    "This is a user-inferred approximation from digitized public graph data, not the official Strava production formula.",
  multiplier: stravaInferredMultiplier,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/stravaInferred.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/models/stravaInferred.ts tests/engine/models/stravaInferred.test.ts
git commit -m "feat: add Strava GAP user-inferred hill model with tests"
```

---

## Task 8: Updated RE3 Demand Model

**Files:**
- Create: `src/engine/models/re3.ts`
- Create: `tests/engine/models/re3.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/models/re3.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/re3.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RE3 demand model**

Write `src/engine/models/re3.ts`:

```ts
import type { PaceModel } from "@engine/types";
import { bisect } from "@engine/utils/bisect";

/**
 * Reconstructed RE3 metabolic demand equation.
 * Mdot = 4.43 + 1.51*S + 0.37*S^2 + 30.43*S*G*(1 - 1.133 / (1 - 1.056^(100*G + 43)))
 *
 * S = speed in m/s
 * G = decimal grade (gradePct / 100)
 */
export function re3Demand(speedMps: number, gradePct: number): number {
  const G = gradePct / 100;
  const S = speedMps;

  return (
    4.43 +
    1.51 * S +
    0.37 * S * S +
    30.43 * S * G * (1 - 1.133 / (1 - Math.pow(1.056, 100 * G + 43)))
  );
}

function re3HillSpeedFromFlatSpeed(flatSpeedMps: number, gradePct: number): number {
  if (Math.abs(gradePct) < 0.001) return flatSpeedMps;

  const target = re3Demand(flatSpeedMps, 0);

  return bisect(
    (vh) => re3Demand(vh, gradePct) - target,
    0.1,
    15
  );
}

export const re3Model: PaceModel = {
  id: "re3",
  label: "Updated RE3 (reconstructed)",
  kind: "demand_model",
  provenance: "reconstructed",
  gradePctMin: -20,
  gradePctMax: 35,
  supportsDownhill: true,
  notes:
    "Promising modern metabolic model intended to improve both uphill and downhill handling.",
  warning:
    "This implementation is reconstructed from OCR/PDF text and may not be character-perfect versus the typeset manuscript.",
  hillSpeedFromFlatSpeed: re3HillSpeedFromFlatSpeed,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/re3.test.ts`
Expected: All 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/models/re3.ts tests/engine/models/re3.test.ts
git commit -m "feat: add Updated RE3 demand hill model with tests"
```

---

## Task 9: Model Registry

**Files:**
- Create: `src/engine/models/registry.ts`
- Create: `tests/engine/models/registry.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/engine/models/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getModel, listModels } from "@engine/models/registry";

describe("model registry", () => {
  it("lists all registered models", () => {
    const models = listModels();
    expect(models.length).toBe(3);
    const ids = models.map((m) => m.id);
    expect(ids).toContain("minetti");
    expect(ids).toContain("strava_inferred");
    expect(ids).toContain("re3");
  });

  it("retrieves a model by id", () => {
    const m = getModel("minetti");
    expect(m.id).toBe("minetti");
    expect(m.label).toBe("Minetti");
  });

  it("throws for unknown model id", () => {
    expect(() => getModel("nonexistent")).toThrow("Unknown model: nonexistent");
  });

  it("returns strava_inferred as default", () => {
    const models = listModels();
    // First model in list should be the default
    expect(models[0].id).toBe("strava_inferred");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/models/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

Write `src/engine/models/registry.ts`:

```ts
import type { PaceModel } from "@engine/types";
import { stravaInferredModel } from "./stravaInferred";
import { minettiModel } from "./minetti";
import { re3Model } from "./re3";

const ALL_MODELS: PaceModel[] = [
  stravaInferredModel,
  minettiModel,
  re3Model,
];

const MODEL_MAP = new Map(ALL_MODELS.map((m) => [m.id, m]));

export function listModels(): PaceModel[] {
  return ALL_MODELS;
}

export function getModel(id: string): PaceModel {
  const model = MODEL_MAP.get(id);
  if (!model) throw new Error(`Unknown model: ${id}`);
  return model;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/models/registry.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/models/registry.ts tests/engine/models/registry.test.ts
git commit -m "feat: add model registry with tests"
```

---

## Task 10: GPX Parser

**Files:**
- Create: `src/engine/course/haversine.ts`
- Create: `src/engine/course/parseGpx.ts`
- Create: `tests/engine/course/haversine.test.ts`
- Create: `tests/engine/course/parseGpx.test.ts`

- [ ] **Step 1: Write failing haversine tests**

Write `tests/engine/course/haversine.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing GPX parser tests**

Write `tests/engine/course/parseGpx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseGpx } from "@engine/course/parseGpx";

const SIMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194">
        <ele>10</ele>
      </trkpt>
      <trkpt lat="37.7759" lon="-122.4194">
        <ele>15</ele>
      </trkpt>
      <trkpt lat="37.7769" lon="-122.4194">
        <ele>20</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const MULTI_SEGMENT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="37.0" lon="-122.0"><ele>10</ele></trkpt>
      <trkpt lat="37.001" lon="-122.0"><ele>20</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="37.001" lon="-122.0"><ele>20</ele></trkpt>
      <trkpt lat="37.002" lon="-122.0"><ele>30</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx", () => {
  it("parses track points from a simple GPX", () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ lat: 37.7749, lon: -122.4194, ele: 10 });
    expect(result[1]).toEqual({ lat: 37.7759, lon: -122.4194, ele: 15 });
    expect(result[2]).toEqual({ lat: 37.7769, lon: -122.4194, ele: 20 });
  });

  it("concatenates multiple track segments", () => {
    const result = parseGpx(MULTI_SEGMENT_GPX);
    expect(result.length).toBe(4);
  });

  it("throws on empty or invalid GPX", () => {
    expect(() => parseGpx("")).toThrow();
    expect(() => parseGpx("<gpx></gpx>")).toThrow("No track points");
  });

  it("throws when elevation is missing", () => {
    const noEle = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="37.0" lon="-122.0"></trkpt>
</trkseg></trk></gpx>`;
    expect(() => parseGpx(noEle)).toThrow("elevation");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/course/`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement haversine**

Write `src/engine/course/haversine.ts`:

```ts
const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 5: Implement GPX parser**

Write `src/engine/course/parseGpx.ts`:

```ts
import type { RawTrackPoint } from "@engine/types";

export function parseGpx(gpxString: string): RawTrackPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`Invalid GPX XML: ${parseError.textContent}`);
  }

  const trkpts = doc.querySelectorAll("trkpt");
  if (trkpts.length === 0) {
    throw new Error("No track points found in GPX");
  }

  const points: RawTrackPoint[] = [];

  trkpts.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute("lat") ?? "");
    const lon = parseFloat(trkpt.getAttribute("lon") ?? "");
    const eleEl = trkpt.querySelector("ele");

    if (!eleEl || eleEl.textContent === null) {
      throw new Error("Track point missing elevation data");
    }

    const ele = parseFloat(eleEl.textContent);

    if (isNaN(lat) || isNaN(lon) || isNaN(ele)) {
      throw new Error("Track point has invalid numeric data");
    }

    points.push({ lat, lon, ele });
  });

  return points;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/course/`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/course/haversine.ts src/engine/course/parseGpx.ts tests/engine/course/haversine.test.ts tests/engine/course/parseGpx.test.ts
git commit -m "feat: add GPX parser and haversine distance with tests"
```

---

## Task 11: Elevation Smoothing and Course Resampling

**Files:**
- Create: `src/engine/course/smoothElevation.ts`
- Create: `src/engine/course/resampleCourse.ts`
- Create: `tests/engine/course/smoothElevation.test.ts`
- Create: `tests/engine/course/resampleCourse.test.ts`

- [ ] **Step 1: Write failing smoothing tests**

Write `tests/engine/course/smoothElevation.test.ts`:

```ts
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
    expect(result[2].elevation).toBeLessThan(50);
    expect(result[2].elevation).toBeGreaterThan(10);
  });

  it("preserves first and last elevation", () => {
    const course = makeCourse([10, 50, 10, 50, 10], 100);
    const result = smoothElevation(course, "medium");
    expect(result[0].elevation).toBe(10);
    expect(result[result.length - 1].elevation).toBe(10);
  });

  it("preserves distances", () => {
    const course = makeCourse([10, 20, 30], 100);
    const result = smoothElevation(course, "heavy");
    expect(result.map((p) => p.distance)).toEqual([0, 100, 200]);
  });

  it("does not modify original array", () => {
    const course = makeCourse([10, 50, 10], 100);
    const originalEle = course[1].elevation;
    smoothElevation(course, "light");
    expect(course[1].elevation).toBe(originalEle);
  });
});
```

- [ ] **Step 2: Write failing resampling tests**

Write `tests/engine/course/resampleCourse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rawPointsToCoursePoints, resampleToMicrosegments } from "@engine/course/resampleCourse";
import type { RawTrackPoint, CoursePoint, Microsegment } from "@engine/types";

describe("rawPointsToCoursePoints", () => {
  it("computes cumulative distance from raw track points", () => {
    const raw: RawTrackPoint[] = [
      { lat: 37.0, lon: -122.0, ele: 10 },
      { lat: 37.001, lon: -122.0, ele: 20 },
      { lat: 37.002, lon: -122.0, ele: 30 },
    ];
    const course = rawPointsToCoursePoints(raw);
    expect(course.length).toBe(3);
    expect(course[0].distance).toBe(0);
    expect(course[1].distance).toBeGreaterThan(100);
    expect(course[2].distance).toBeGreaterThan(course[1].distance);
    expect(course[0].elevation).toBe(10);
    expect(course[2].elevation).toBe(30);
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
    expect(segs[0].startDistance).toBe(0);
    expect(segs[0].endDistance).toBeCloseTo(200);
    expect(segs[0].distance).toBeCloseTo(200);
    expect(segs[4].endDistance).toBeCloseTo(1000);
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
    const last = segs[segs.length - 1];
    expect(last.distance).toBeCloseTo(100);
    expect(last.endDistance).toBeCloseTo(1000);
  });

  it("reports start and end elevation per segment", () => {
    const segs = resampleToMicrosegments(course, 500);
    expect(segs[0].startElevation).toBeCloseTo(0);
    expect(segs[0].endElevation).toBeCloseTo(50);
    expect(segs[1].startElevation).toBeCloseTo(50);
    expect(segs[1].endElevation).toBeCloseTo(100);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/course/smoothElevation.test.ts tests/engine/course/resampleCourse.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement elevation smoothing**

Write `src/engine/course/smoothElevation.ts`:

```ts
import type { CoursePoint, SmoothingLevel } from "@engine/types";

const WINDOW_SIZES: Record<SmoothingLevel, number> = {
  none: 1,
  light: 3,
  medium: 7,
  heavy: 15,
};

export function smoothElevation(
  course: CoursePoint[],
  level: SmoothingLevel
): CoursePoint[] {
  const window = WINDOW_SIZES[level];

  if (window <= 1 || course.length <= 2) {
    return course.map((p) => ({ ...p }));
  }

  const half = Math.floor(window / 2);
  const n = course.length;

  return course.map((point, i) => {
    // Preserve first and last points
    if (i === 0 || i === n - 1) {
      return { ...point };
    }

    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      sum += course[j].elevation;
      count++;
    }

    return { distance: point.distance, elevation: sum / count };
  });
}
```

- [ ] **Step 5: Implement course resampling**

Write `src/engine/course/resampleCourse.ts`:

```ts
import type { RawTrackPoint, CoursePoint, Microsegment } from "@engine/types";
import { haversineMeters } from "./haversine";

export function rawPointsToCoursePoints(raw: RawTrackPoint[]): CoursePoint[] {
  const result: CoursePoint[] = [{ distance: 0, elevation: raw[0].ele }];

  let cumDist = 0;
  for (let i = 1; i < raw.length; i++) {
    const d = haversineMeters(
      raw[i - 1].lat,
      raw[i - 1].lon,
      raw[i].lat,
      raw[i].lon
    );
    cumDist += d;
    result.push({ distance: cumDist, elevation: raw[i].ele });
  }

  return result;
}

function interpElevation(course: CoursePoint[], dist: number): number {
  if (dist <= course[0].distance) return course[0].elevation;
  if (dist >= course[course.length - 1].distance) {
    return course[course.length - 1].elevation;
  }

  for (let i = 1; i < course.length; i++) {
    if (dist <= course[i].distance) {
      const d0 = course[i - 1].distance;
      const d1 = course[i].distance;
      const e0 = course[i - 1].elevation;
      const e1 = course[i].elevation;
      const t = (dist - d0) / (d1 - d0);
      return e0 + t * (e1 - e0);
    }
  }

  return course[course.length - 1].elevation;
}

export function resampleToMicrosegments(
  course: CoursePoint[],
  segmentDistance: number
): Microsegment[] {
  const totalDist = course[course.length - 1].distance;
  const segments: Microsegment[] = [];

  let startDist = 0;
  while (startDist < totalDist - 0.01) {
    const endDist = Math.min(startDist + segmentDistance, totalDist);
    const dist = endDist - startDist;
    const startEle = interpElevation(course, startDist);
    const endEle = interpElevation(course, endDist);
    const elevChange = endEle - startEle;
    const gradePct = dist > 0 ? (elevChange / dist) * 100 : 0;

    segments.push({
      startDistance: startDist,
      endDistance: endDist,
      distance: dist,
      startElevation: startEle,
      endElevation: endEle,
      avgGradePct: gradePct,
    });

    startDist = endDist;
  }

  return segments;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/engine/course/`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/course/smoothElevation.ts src/engine/course/resampleCourse.ts tests/engine/course/smoothElevation.test.ts tests/engine/course/resampleCourse.test.ts
git commit -m "feat: add elevation smoothing and course resampling with tests"
```

---

## Task 12: Whole-Course Solver

**Files:**
- Create: `src/engine/planner/solver.ts`
- Create: `tests/engine/planner/solver.test.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/engine/planner/solver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { solveWholeCourse } from "@engine/planner/solver";
import type { Microsegment, PaceModel } from "@engine/types";

// Trivial flat model: multiplier always 1.0
const flatModel: PaceModel = {
  id: "test_flat",
  label: "Test Flat",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: () => 1.0,
};

// Simple uphill model: multiplier = 1 + grade/10
const simpleUphillModel: PaceModel = {
  id: "test_uphill",
  label: "Test Uphill",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: (g) => 1 + g / 10,
};

// Simple demand model: demand = speed * (1 + grade/10)
const simpleDemandModel: PaceModel = {
  id: "test_demand",
  label: "Test Demand",
  kind: "demand_model",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  hillSpeedFromFlatSpeed: (flatSpeed, gradePct) => {
    // D(v,g) = v * (1 + g/10); solve v_h*(1+g/10) = v_f*1 → v_h = v_f/(1+g/10)
    return flatSpeed / (1 + gradePct / 10);
  },
};

function makeSegments(
  count: number,
  distEach: number,
  grades: number[]
): Microsegment[] {
  return grades.map((g, i) => ({
    startDistance: i * distEach,
    endDistance: (i + 1) * distEach,
    distance: distEach,
    startElevation: 0,
    endElevation: 0,
    avgGradePct: g,
  }));
}

describe("solveWholeCourse — direct multiplier", () => {
  it("solves flat course to match target time", () => {
    // 10 segments of 1000m each = 10km, target 3600s (1 hour)
    const segs = makeSegments(10, 1000, Array(10).fill(0));
    const result = solveWholeCourse(segs, flatModel, 3600);

    expect(result.length).toBe(10);
    const totalTime = result.reduce((s, r) => s + r.targetTimeSec, 0);
    expect(totalTime).toBeCloseTo(3600, 1);
  });

  it("all segments have equal pace on flat course", () => {
    const segs = makeSegments(5, 1000, Array(5).fill(0));
    const result = solveWholeCourse(segs, flatModel, 1800);
    const paces = result.map((r) => r.targetPaceSecPerMeter);
    for (const p of paces) {
      expect(p).toBeCloseTo(paces[0], 6);
    }
  });

  it("uphill segments are slower than flat segments", () => {
    const segs = makeSegments(2, 1000, [0, 10]);
    const result = solveWholeCourse(segs, simpleUphillModel, 1000);
    expect(result[1].targetPaceSecPerMeter).toBeGreaterThan(
      result[0].targetPaceSecPerMeter
    );
  });

  it("cumulative elapsed increases monotonically", () => {
    const segs = makeSegments(5, 1000, [0, 5, -3, 8, 2]);
    const result = solveWholeCourse(segs, simpleUphillModel, 3000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].cumulativeElapsedSec).toBeGreaterThan(
        result[i - 1].cumulativeElapsedSec
      );
    }
  });

  it("total time matches target within tolerance", () => {
    const segs = makeSegments(5, 1000, [0, 5, -3, 8, 2]);
    const result = solveWholeCourse(segs, simpleUphillModel, 3000);
    const total = result[result.length - 1].cumulativeElapsedSec;
    expect(total).toBeCloseTo(3000, 1);
  });
});

describe("solveWholeCourse — demand model", () => {
  it("solves flat course to match target time", () => {
    const segs = makeSegments(5, 1000, Array(5).fill(0));
    const result = solveWholeCourse(segs, simpleDemandModel, 2500);
    const totalTime = result.reduce((s, r) => s + r.targetTimeSec, 0);
    expect(totalTime).toBeCloseTo(2500, 0);
  });

  it("uphill segments are slower", () => {
    const segs = makeSegments(3, 1000, [0, 5, 10]);
    const result = solveWholeCourse(segs, simpleDemandModel, 2000);
    expect(result[1].targetTimeSec).toBeGreaterThan(result[0].targetTimeSec);
    expect(result[2].targetTimeSec).toBeGreaterThan(result[1].targetTimeSec);
  });

  it("total time matches target within tolerance", () => {
    const segs = makeSegments(4, 1000, [0, 5, -2, 8]);
    const result = solveWholeCourse(segs, simpleDemandModel, 2000);
    const total = result[result.length - 1].cumulativeElapsedSec;
    expect(total).toBeCloseTo(2000, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/planner/solver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the solver**

Write `src/engine/planner/solver.ts`:

```ts
import type { Microsegment, PaceModel, SegmentResult } from "@engine/types";
import { bisect } from "@engine/utils/bisect";

function solveDirectMultiplier(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  const mult = model.multiplier!;

  // flatEqPace = targetTime / sum(d_i * M(g_i))
  const weightedDistance = segments.reduce(
    (sum, seg) => sum + seg.distance * mult(seg.avgGradePct),
    0
  );
  const flatEqPace = targetTimeSec / weightedDistance; // sec per meter

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const m = mult(seg.avgGradePct);
    const pace = flatEqPace * m;
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

function solveDemandModel(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  const hillSpeed = model.hillSpeedFromFlatSpeed!;

  function totalTimeForFlatSpeed(flatSpeedMps: number): number {
    let total = 0;
    for (const seg of segments) {
      const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
      total += seg.distance / vh;
    }
    return total;
  }

  // Outer solve: find flatSpeedMps such that totalTime = targetTimeSec
  // Faster flat speed → less total time
  // f(v) = totalTime(v) - target: want f(v) = 0
  // totalTime decreases as v increases, so f is decreasing
  // We need f(lo) > 0 and f(hi) < 0 → lo is slow, hi is fast
  const flatSpeedMps = bisect(
    (v) => totalTimeForFlatSpeed(v) - targetTimeSec,
    0.3, // very slow: ~55 min/mi
    10.0 // very fast: ~2:40/mi
  );

  let cumElapsed = 0;
  return segments.map((seg, i) => {
    const vh = hillSpeed(flatSpeedMps, seg.avgGradePct);
    const pace = 1 / vh; // sec per meter
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

export function solveWholeCourse(
  segments: Microsegment[],
  model: PaceModel,
  targetTimeSec: number
): SegmentResult[] {
  if (model.kind === "demand_model" && model.hillSpeedFromFlatSpeed) {
    return solveDemandModel(segments, model, targetTimeSec);
  }

  if (model.multiplier) {
    return solveDirectMultiplier(segments, model, targetTimeSec);
  }

  throw new Error(`Model "${model.id}" has neither multiplier nor hillSpeedFromFlatSpeed`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/planner/solver.test.ts`
Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/planner/solver.ts tests/engine/planner/solver.test.ts
git commit -m "feat: add whole-course solver for both multiplier and demand models with tests"
```

---

## Task 13: Mile-by-Mile Aggregation

**Files:**
- Create: `src/engine/planner/aggregateMiles.ts`
- Create: `tests/engine/planner/aggregateMiles.test.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/engine/planner/aggregateMiles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { aggregateMileSplits } from "@engine/planner/aggregateMiles";
import type { SegmentResult } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

function makeResults(
  count: number,
  distEach: number,
  paceSecPerMeter: number
): SegmentResult[] {
  let cumElapsed = 0;
  return Array.from({ length: count }, (_, i) => {
    const time = distEach * paceSecPerMeter;
    cumElapsed += time;
    return {
      segmentId: i,
      startDistance: i * distEach,
      endDistance: (i + 1) * distEach,
      distance: distEach,
      avgGradePct: 0,
      modelValue: 1,
      targetPaceSecPerMeter: paceSecPerMeter,
      targetTimeSec: time,
      cumulativeElapsedSec: cumElapsed,
    };
  });
}

describe("aggregateMileSplits", () => {
  it("produces correct number of mile splits", () => {
    // 5 miles = 5 * 1609.344m, using 160.934m segments (~0.1mi) → 50 segments
    const segDist = METERS_PER_MILE / 10; // 160.9344m
    const pace = 600 / METERS_PER_MILE; // 10:00/mi in sec/m
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    expect(splits.length).toBe(5);
  });

  it("each split has correct pace on uniform course", () => {
    const segDist = METERS_PER_MILE / 10;
    const pacePerMile = 600; // 10:00/mi
    const pace = pacePerMile / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    for (const split of splits) {
      expect(split.paceSecPerMile).toBeCloseTo(600, 0);
    }
  });

  it("elapsed time increases with each mile", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(50, segDist, pace);
    const splits = aggregateMileSplits(results);
    for (let i = 1; i < splits.length; i++) {
      expect(splits[i].elapsedSec).toBeGreaterThan(splits[i - 1].elapsedSec);
    }
  });

  it("final elapsed matches total segment time", () => {
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const numSegs = 50;
    const results = makeResults(numSegs, segDist, pace);
    const splits = aggregateMileSplits(results);
    const lastSplit = splits[splits.length - 1];
    const lastSegment = results[results.length - 1];
    expect(lastSplit.elapsedSec).toBeCloseTo(lastSegment.cumulativeElapsedSec, 0);
  });

  it("handles partial final mile", () => {
    // 5.5 miles of segments
    const segDist = METERS_PER_MILE / 10;
    const pace = 600 / METERS_PER_MILE;
    const results = makeResults(55, segDist, pace);
    const splits = aggregateMileSplits(results);
    // Should have 6 entries: miles 1-5 plus partial mile 6
    expect(splits.length).toBe(6);
    expect(splits[5].mile).toBe(6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/planner/aggregateMiles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement mile aggregation**

Write `src/engine/planner/aggregateMiles.ts`:

```ts
import type { SegmentResult, MileSplit } from "@engine/types";
import { METERS_PER_MILE } from "@engine/utils/units";

export function aggregateMileSplits(segments: SegmentResult[]): MileSplit[] {
  if (segments.length === 0) return [];

  const totalDistance = segments[segments.length - 1].endDistance;
  const totalMiles = Math.ceil(totalDistance / METERS_PER_MILE);
  const splits: MileSplit[] = [];

  let prevMileElapsed = 0;

  for (let mile = 1; mile <= totalMiles; mile++) {
    const mileEndDist = mile * METERS_PER_MILE;
    let elapsed = 0;

    // Sum time for all segments up to this mile marker
    for (const seg of segments) {
      if (seg.endDistance <= mileEndDist) {
        // Entire segment is within this mile boundary
        elapsed = seg.cumulativeElapsedSec;
      } else if (seg.startDistance < mileEndDist) {
        // Partial segment — interpolate
        const fraction =
          (mileEndDist - seg.startDistance) / seg.distance;
        elapsed =
          (seg.cumulativeElapsedSec - seg.targetTimeSec) +
          fraction * seg.targetTimeSec;
        break;
      } else {
        break;
      }
    }

    // If mile marker is past course end, use total time
    if (mileEndDist >= totalDistance) {
      elapsed = segments[segments.length - 1].cumulativeElapsedSec;
    }

    const mileTime = elapsed - prevMileElapsed;

    // For the last partial mile, compute pace relative to actual distance
    let mileDistance = METERS_PER_MILE;
    if (mile === totalMiles && totalDistance < mileEndDist) {
      mileDistance = totalDistance - (mile - 1) * METERS_PER_MILE;
    }

    const paceSecPerMile =
      mileDistance > 0 ? (mileTime / mileDistance) * METERS_PER_MILE : 0;

    splits.push({
      mile,
      paceSecPerMile,
      elapsedSec: elapsed,
    });

    prevMileElapsed = elapsed;
  }

  return splits;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/planner/aggregateMiles.test.ts`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/planner/aggregateMiles.ts tests/engine/planner/aggregateMiles.test.ts
git commit -m "feat: add mile-by-mile split aggregation with tests"
```

---

## Task 14: Summary Computation and Pipeline

**Files:**
- Create: `src/engine/planner/summary.ts`
- Create: `src/engine/planner/pipeline.ts`
- Create: `tests/engine/planner/summary.test.ts`
- Create: `tests/engine/planner/pipeline.test.ts`

- [ ] **Step 1: Write failing summary tests**

Write `tests/engine/planner/summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSummary } from "@engine/planner/summary";
import type { Microsegment, SegmentResult, PaceModel } from "@engine/types";

const testModel: PaceModel = {
  id: "test",
  label: "Test Model",
  kind: "direct_multiplier",
  provenance: "official",
  gradePctMin: -50,
  gradePctMax: 50,
  supportsDownhill: true,
  notes: "",
  multiplier: () => 1.0,
};

describe("computeSummary", () => {
  it("computes course length from segments", () => {
    const segs: Microsegment[] = [
      { startDistance: 0, endDistance: 1000, distance: 1000, startElevation: 0, endElevation: 10, avgGradePct: 1 },
      { startDistance: 1000, endDistance: 2000, distance: 1000, startElevation: 10, endElevation: 5, avgGradePct: -0.5 },
    ];
    const results: SegmentResult[] = [
      { segmentId: 0, startDistance: 0, endDistance: 1000, distance: 1000, avgGradePct: 1, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 300 },
      { segmentId: 1, startDistance: 1000, endDistance: 2000, distance: 1000, avgGradePct: -0.5, modelValue: 1, targetPaceSecPerMeter: 0.3, targetTimeSec: 300, cumulativeElapsedSec: 600 },
    ];
    const summary = computeSummary(segs, results, testModel, 600);

    expect(summary.courseLengthMeters).toBe(2000);
    expect(summary.totalClimbMeters).toBe(10);
    expect(summary.totalDescentMeters).toBe(5);
    expect(summary.targetFinishTimeSec).toBe(600);
    expect(summary.computedFinishTimeSec).toBeCloseTo(600);
    expect(summary.modelId).toBe("test");
  });
});
```

- [ ] **Step 2: Write failing pipeline integration test**

Write `tests/engine/planner/pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateRacePlan } from "@engine/planner/pipeline";

const SIMPLE_HILL_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Hill</name>
    <trkseg>
      <trkpt lat="37.0000" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0045" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0090" lon="-122.0"><ele>150</ele></trkpt>
      <trkpt lat="37.0135" lon="-122.0"><ele>200</ele></trkpt>
      <trkpt lat="37.0180" lon="-122.0"><ele>200</ele></trkpt>
      <trkpt lat="37.0225" lon="-122.0"><ele>150</ele></trkpt>
      <trkpt lat="37.0270" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0315" lon="-122.0"><ele>100</ele></trkpt>
      <trkpt lat="37.0360" lon="-122.0"><ele>100</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("generateRacePlan", () => {
  it("generates a complete plan with Minetti model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });

    expect(plan.segments.length).toBeGreaterThan(0);
    expect(plan.mileSplits.length).toBeGreaterThan(0);
    expect(plan.summary.modelId).toBe("minetti");
    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
    expect(plan.summary.totalClimbMeters).toBeGreaterThan(0);
    expect(plan.summary.totalDescentMeters).toBeGreaterThan(0);
  });

  it("generates a plan with Strava inferred model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "strava_inferred",
    });

    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
  });

  it("generates a plan with RE3 demand model", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "re3",
    });

    expect(plan.summary.computedFinishTimeSec).toBeCloseTo(3600, 0);
  });

  it("uphill mile splits are slower than flat mile splits", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });

    // First mile should be mostly flat, second mile has the climb
    // With sufficient course length, we can check relative paces
    const paces = plan.mileSplits.map((s) => s.paceSecPerMile);
    // At least one pace should differ from another (not all equal)
    const allEqual = paces.every((p) => Math.abs(p - paces[0]) < 1);
    expect(allEqual).toBe(false);
  });

  it("returns warnings for empty warnings array", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "minetti",
    });
    expect(Array.isArray(plan.warnings)).toBe(true);
  });

  it("model warning is included when model has one", () => {
    const plan = generateRacePlan({
      gpxData: SIMPLE_HILL_GPX,
      targetFinishTimeSec: 3600,
      modelId: "strava_inferred",
    });
    expect(plan.warnings.some((w) => w.includes("user-inferred"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/engine/planner/summary.test.ts tests/engine/planner/pipeline.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement summary computation**

Write `src/engine/planner/summary.ts`:

```ts
import type {
  Microsegment,
  SegmentResult,
  PaceModel,
  PlanSummary,
} from "@engine/types";
import { speedMpsToPaceSecPerMile, METERS_PER_MILE } from "@engine/utils/units";

export function computeSummary(
  microsegments: Microsegment[],
  results: SegmentResult[],
  model: PaceModel,
  targetFinishTimeSec: number
): PlanSummary {
  const courseLengthMeters =
    microsegments[microsegments.length - 1].endDistance;

  let totalClimb = 0;
  let totalDescent = 0;
  for (const seg of microsegments) {
    const diff = seg.endElevation - seg.startElevation;
    if (diff > 0) totalClimb += diff;
    else totalDescent += Math.abs(diff);
  }

  const computedFinishTimeSec =
    results[results.length - 1].cumulativeElapsedSec;

  // Weighted distance: sum(d_i * M_i) for multiplier models
  const weightedDistance = results.reduce(
    (sum, r) => sum + r.distance * r.modelValue,
    0
  );

  // Flat-equivalent pace: target time / weighted distance (for multiplier models)
  // For demand models, use total distance / total time as average pace
  const flatEqPaceSecPerMeter =
    model.kind === "demand_model"
      ? computedFinishTimeSec / courseLengthMeters
      : targetFinishTimeSec / weightedDistance;

  const flatEquivalentPaceSecPerMile = flatEqPaceSecPerMeter * METERS_PER_MILE;

  return {
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

- [ ] **Step 5: Implement the pipeline**

Write `src/engine/planner/pipeline.ts`:

```ts
import type { PlannerInput, RacePlan } from "@engine/types";
import { parseGpx } from "@engine/course/parseGpx";
import { rawPointsToCoursePoints, resampleToMicrosegments } from "@engine/course/resampleCourse";
import { smoothElevation } from "@engine/course/smoothElevation";
import { getModel } from "@engine/models/registry";
import { solveWholeCourse } from "./solver";
import { aggregateMileSplits } from "./aggregateMiles";
import { computeSummary } from "./summary";

const DEFAULT_SEGMENT_DISTANCE = 160.934; // ~0.1 miles in meters

export function generateRacePlan(input: PlannerInput): RacePlan {
  const warnings: string[] = [];

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
  const model = getModel(input.modelId);

  // Collect model warning
  if (model.warning) {
    warnings.push(model.warning);
  }

  // Check grade range warnings
  const minGrade = Math.min(...microsegments.map((s) => s.avgGradePct));
  const maxGrade = Math.max(...microsegments.map((s) => s.avgGradePct));
  if (minGrade < model.gradePctMin || maxGrade > model.gradePctMax) {
    warnings.push(
      `Course grades (${minGrade.toFixed(1)}% to ${maxGrade.toFixed(1)}%) exceed model's recommended range (${model.gradePctMin}% to ${model.gradePctMax}%).`
    );
  }

  // 6. Solve
  const segmentResults = solveWholeCourse(
    microsegments,
    model,
    input.targetFinishTimeSec
  );

  // 7. Aggregate mile splits
  const mileSplits = aggregateMileSplits(segmentResults);

  // 8. Compute summary
  const summary = computeSummary(
    microsegments,
    segmentResults,
    model,
    input.targetFinishTimeSec
  );

  return { summary, segments: segmentResults, mileSplits, warnings };
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/engine/planner/summary.ts src/engine/planner/pipeline.ts tests/engine/planner/summary.test.ts tests/engine/planner/pipeline.test.ts
git commit -m "feat: add plan summary, pipeline, and integration tests"
```

---

## Task 15: Web UI — Course Upload and Planner Form

**Files:**
- Create: `src/ui/components/CourseUpload.tsx`
- Create: `src/ui/components/PlannerForm.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement CourseUpload component**

Write `src/ui/components/CourseUpload.tsx`:

```tsx
import { useCallback } from "react";

interface CourseUploadProps {
  onFileLoaded: (gpxData: string, fileName: string) => void;
}

export function CourseUpload({ onFileLoaded }: CourseUploadProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onFileLoaded(reader.result, file.name);
        }
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  return (
    <div className="form-group">
      <label htmlFor="gpx-upload">Course file (GPX)</label>
      <input
        id="gpx-upload"
        type="file"
        accept=".gpx"
        onChange={handleChange}
      />
    </div>
  );
}
```

- [ ] **Step 2: Implement PlannerForm component**

Write `src/ui/components/PlannerForm.tsx`:

```tsx
import type { SmoothingLevel } from "@engine/types";
import { listModels } from "@engine/models/registry";

interface PlannerFormProps {
  targetTime: string;
  onTargetTimeChange: (value: string) => void;
  modelId: string;
  onModelIdChange: (value: string) => void;
  smoothing: SmoothingLevel;
  onSmoothingChange: (value: SmoothingLevel) => void;
  canRun: boolean;
  onRun: () => void;
}

export function PlannerForm({
  targetTime,
  onTargetTimeChange,
  modelId,
  onModelIdChange,
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
          <label htmlFor="target-time">Target finish time</label>
          <input
            id="target-time"
            type="text"
            placeholder="14:00 or 840 (minutes)"
            value={targetTime}
            onChange={(e) => onTargetTimeChange(e.target.value)}
          />
        </div>

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

      <button disabled={!canRun} onClick={onRun}>
        Generate Plan
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire up App.tsx with state management**

Replace `src/App.tsx`:

```tsx
import { useState, useCallback } from "react";
import type { RacePlan, SmoothingLevel } from "@engine/types";
import { parseTargetTime } from "@engine/utils/paceFormatting";
import { generateRacePlan } from "@engine/planner/pipeline";
import { CourseUpload } from "@ui/components/CourseUpload";
import { PlannerForm } from "@ui/components/PlannerForm";
import { SummaryPanel } from "@ui/components/SummaryPanel";
import { MileSplitsTable } from "@ui/components/MileSplitsTable";
import "./App.css";

export default function App() {
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [targetTime, setTargetTime] = useState("14:00");
  const [modelId, setModelId] = useState("strava_inferred");
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
      const targetSec = parseTargetTime(targetTime);
      const result = generateRacePlan({
        gpxData,
        targetFinishTimeSec: targetSec,
        modelId,
        smoothing,
      });
      setPlan(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlan(null);
    }
  }, [gpxData, targetTime, modelId, smoothing]);

  const canRun = gpxData !== null && targetTime.trim() !== "";

  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>

      <CourseUpload onFileLoaded={handleFileLoaded} />
      {fileName && <p>Loaded: {fileName}</p>}

      <PlannerForm
        targetTime={targetTime}
        onTargetTimeChange={setTargetTime}
        modelId={modelId}
        onModelIdChange={setModelId}
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

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: Will fail because SummaryPanel and MileSplitsTable don't exist yet — that's expected. Proceed to next task.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/CourseUpload.tsx src/ui/components/PlannerForm.tsx src/App.tsx
git commit -m "feat: add course upload and planner form UI components"
```

---

## Task 16: Web UI — Results Display

**Files:**
- Create: `src/ui/components/SummaryPanel.tsx`
- Create: `src/ui/components/MileSplitsTable.tsx`

- [ ] **Step 1: Implement SummaryPanel**

Write `src/ui/components/SummaryPanel.tsx`:

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
  return (
    <div>
      <h2>Plan Summary</h2>
      <dl className="summary-grid">
        <dt>Hill model</dt>
        <dd>{summary.modelLabel}</dd>

        <dt>Target finish time</dt>
        <dd>{formatElapsedTime(summary.targetFinishTimeSec)}</dd>

        <dt>Computed finish time</dt>
        <dd>{formatElapsedTime(summary.computedFinishTimeSec)}</dd>

        <dt>Course length</dt>
        <dd>{metersToMiles(summary.courseLengthMeters).toFixed(2)} mi</dd>

        <dt>Total climb</dt>
        <dd>{metersToFeet(summary.totalClimbMeters).toFixed(0)} ft</dd>

        <dt>Total descent</dt>
        <dd>{metersToFeet(summary.totalDescentMeters).toFixed(0)} ft</dd>

        <dt>Flat-equivalent pace</dt>
        <dd>{formatPace(summary.flatEquivalentPaceSecPerMile)} /mi</dd>
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Implement MileSplitsTable**

Write `src/ui/components/MileSplitsTable.tsx`:

```tsx
import type { MileSplit } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

interface MileSplitsTableProps {
  splits: MileSplit[];
}

export function MileSplitsTable({ splits }: MileSplitsTableProps) {
  return (
    <div>
      <h2>Mile Splits</h2>
      <table>
        <thead>
          <tr>
            <th>Mile</th>
            <th>Target Pace</th>
            <th>Elapsed Time</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={split.mile}>
              <td>{split.mile}</td>
              <td>{formatPace(split.paceSecPerMile)} /mi</td>
              <td>{formatElapsedTime(split.elapsedSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify full build**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npx vite build`
Expected: Build completes successfully.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SummaryPanel.tsx src/ui/components/MileSplitsTable.tsx
git commit -m "feat: add summary panel and mile splits table UI components"
```

---

## Task 17: Manual Smoke Test and Polish

**Files:**
- Modify: `src/App.css` (if needed)

- [ ] **Step 1: Start dev server and test manually**

Run: `npx vite --port 5173`

Manual test checklist:
1. Page loads with "Race Plan Calculator" heading
2. File upload accepts a `.gpx` file
3. Target time defaults to "14:00"
4. Model dropdown shows all 3 models with Strava GAP selected
5. Clicking "Generate Plan" with a loaded GPX produces a summary and mile splits table
6. Changing model and re-running produces different splits
7. Invalid target time shows an error message
8. Model warning appears for Strava inferred and RE3

- [ ] **Step 2: Fix any issues found during smoke test**

If any issues are found, fix them and re-run the relevant tests.

- [ ] **Step 3: Run full test suite one final time**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: polish UI and complete MVP smoke test"
```
