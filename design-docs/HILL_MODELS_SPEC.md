# HILL_MODELS_SPEC.md

## Goal

Build a pluggable hill-pacing engine for a race-plan calculator.

The calculator should let the user choose which hill model to use, rather than hard-coding one unknown internal model.

The engine should support:

- direct grade-to-multiplier models
- speed-dependent metabolic / demand models
- empirical interpolation models
- user-calibrated personal models
- clearly labeled proprietary / unavailable models

---

## Core pacing convention

Use one common convention everywhere:

**hill pace = flat-equivalent pace × multiplier**

Where:

- `multiplier = 1.0` on flat
- `multiplier > 1.0` uphill
- `multiplier < 1.0` on moderate downhills

This makes all model outputs easy to compare.

For models that are already cost-per-distance style, the multiplier is usually direct.

For models that are metabolic-rate / oxygen-cost / power models, compute the multiplier by solving for the hill speed that gives the same flat demand.

---

## Required architecture

Create a pluggable model interface.

### TypeScript interface

```ts
export type ModelKind =
  | "direct_multiplier"
  | "demand_model"
  | "empirical_interpolation"
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
  refFlatPaceSecPerKm?: number;
  hillPaceSecPerKm?: number;

  // optional, only for power-based personal models
  userPowerCurve?: (speedMps: number) => number;
}

export interface PaceModel {
  id: string;
  label: string;
  category:
    | "metabolic_equivalent"
    | "empirical_flat_equivalent"
    | "power_equivalent"
    | "unavailable";

  kind: ModelKind;
  provenance: Provenance;

  gradePctMin: number;
  gradePctMax: number;
  supportsDownhill: boolean;

  notes: string;
  warning?: string;

  // For direct multiplier models
  multiplier?: (gradePct: number, ctx?: PaceModelContext) => number;

  // For speed-dependent models
  hillSpeedFromFlatSpeed?: (
    flatSpeedMps: number,
    gradePct: number,
    ctx?: PaceModelContext
  ) => number;
}
```

---

## Race-planning engine

Implement two planning pathways.

### 1. Direct multiplier path

For models that directly return a multiplier:

- segment time:
  `t_i = d_i * flatEqPace * M(g_i)`

- total target-time solve:
  `flatEqPace = targetTime / sum(d_i * M(g_i))`

Use this for:

- Minetti
- Strava GAP (user-inferred interpolation)
- van Dijk & van Megen ECOR hill formula
- HillRunner renormalized surrogate
- any pre-fit personal multiplier curve

### 2. Demand-model path

For models that compute demand / cost / metabolic rate:

1. choose a candidate flat-equivalent speed `v_flat`
2. for each segment, solve hill speed `v_hill` such that

   `Demand(v_hill, grade) = Demand(v_flat, 0)`

3. compute segment time `t_i = d_i / v_hill`
4. outer-solve `v_flat` so total segment times sum to the user’s target finish time

Use this for:

- ACSM
- Updated HTK
- Updated RE3
- Running Writings
- personal Stryd-like model when a user flat power-speed curve exists

---

## Shared numeric helper

Use monotone bisection for root-finding.

```ts
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-6,
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

---

# Models to implement

## 1) Minetti

### Category
`metabolic_equivalent`

### Kind
`direct_multiplier`

### Formula

Let:

- `g = gradePct / 100` as decimal grade

Running cost polynomial:

```text
Cr(g) = 155.4*g^5 - 30.4*g^4 - 43.3*g^3 + 46.3*g^2 + 19.5*g + 3.6
```

Use normalized multiplier:

```text
M(g) = Cr(g) / Cr(0)
```

Since `Cr(0) = 3.6`, this guarantees:

- `M(0) = 1.0`

### TypeScript

```ts
export function minettiMultiplier(gradePct: number): number {
  const g = gradePct / 100;
  const cr =
    155.4 * g ** 5 -
    30.4 * g ** 4 -
    43.3 * g ** 3 +
    46.3 * g ** 2 +
    19.5 * g +
    3.6;

  return cr / 3.6;
}
```

### Notes

- Strong classic model
- Very useful
- Tends to over-credit steep downhills for real-world racing

---

## 2) Strava improved GAP (user-inferred)

### Category
`empirical_flat_equivalent`

### Kind
`empirical_interpolation`

### Provenance
`user-inferred`

### Important note

Do **not** claim this is the official Strava formula.

This model should be labeled clearly as:

- user-inferred
- based on digitized points
- not official Strava code

### Implementation

Use extracted `[gradePct, multiplier]` points as canonical data.

Inside the supported range:
- linear interpolation

Optional outside the supported range:
- fallback quadratic:
  `M(g) = 1 + 0.029*g + 0.0015*g^2`
  where `g` is in percent

### TypeScript

```ts
export const STRAVA_INFERRED_POINTS: Array<[number, number]> = [
  // Replace with actual extracted points
  // Example:
  // [-10.2998278961908, 0.875264110476409],
  // [0.00918085144727598, 1.00189035065393],
  // [10.3181895990853, 1.48025614688013],
];

export function interp1d(points: Array<[number, number]>, x: number): number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);

  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];

  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    if (x <= x2) {
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }

  throw new Error("Interpolation failed");
}

export function stravaInferredMultiplier(
  gradePct: number,
  useFallback = true
): number {
  const pts = [...STRAVA_INFERRED_POINTS].sort((a, b) => a[0] - b[0]);
  const minX = pts[0][0];
  const maxX = pts[pts.length - 1][0];

  if (gradePct >= minX && gradePct <= maxX) {
    return interp1d(pts, gradePct);
  }

  if (!useFallback) {
    return gradePct < minX ? pts[0][1] : pts[pts.length - 1][1];
  }

  return 1 + 0.029 * gradePct + 0.0015 * gradePct ** 2;
}
```

---

## 3) ACSM

### Category
`metabolic_equivalent`

### Kind
`demand_model`

### Formula

Standard ACSM running equation:

```text
VO2 = 3.5 + 0.2*S + 0.9*S*g
```

Where:

- `S` is speed in meters per minute
- `g` is decimal grade

To solve hill speed from flat speed at equal effort:

```text
3.5 + 0.2*S_h + 0.9*S_h*g = 3.5 + 0.2*S_f
```

So:

```text
S_h = (0.2 * S_f) / (0.2 + 0.9*g)
```

### TypeScript

```ts
export function acsmHillSpeedFromFlatSpeed(
  flatSpeedMps: number,
  gradePct: number
): number {
  const g = gradePct / 100;
  const Sf = flatSpeedMps * 60; // m/min
  const Sh = (0.2 * Sf) / (0.2 + 0.9 * g);
  return Sh / 60; // back to m/s
}
```

### Notes

- Simple
- Familiar
- Usually too crude for serious hill pacing
- Handles downhill poorly if extrapolated too far

---

## 4) Updated HTK

### Category
`metabolic_equivalent`

### Kind
`direct_multiplier` or `demand_model`

### Formula

Use:

```text
Mdot = Mdot_stand + S * (
  2.01
  + 1.74 * exp(-18.24 * sin(theta))
  + (9.81 / 0.23) * sin(theta)
)
```

Where:

- `Mdot_stand = 1.44`
- `S` in m/s
- `theta` is slope angle

Convert grade to slope angle via:

```text
G = gradePct / 100
sin(theta) = G / sqrt(1 + G^2)
```

### Shortcut for multiplier

Because the standing term is constant and the speed term is linear, this model can be used as a direct multiplier:

```text
term(g) = 2.01 + 1.74 * exp(-18.24 * sin(theta)) + (9.81 / 0.23) * sin(theta)
M(g) = term(g) / term(0)
```

### TypeScript

```ts
export function htkMultiplier(gradePct: number): number {
  const G = gradePct / 100;
  const sinTheta = G / Math.sqrt(1 + G * G);

  const term =
    2.01 +
    1.74 * Math.exp(-18.24 * sinTheta) +
    (9.81 / 0.23) * sinTheta;

  const term0 = 2.01 + 1.74;

  return term / term0;
}
```

### Notes

- Strong mechanistic metabolic model
- Best for level and uphill
- Do not oversell downhill support

---

## 5) Updated RE3 (reconstructed)

### Category
`metabolic_equivalent`

### Kind
`demand_model`

### Provenance
`reconstructed`

### Important note

Label this clearly as:

- reconstructed from OCR / PDF excerpts
- not copied from a clean typeset equation

### Formula

```text
Mdot =
  4.43
  + 1.51*S
  + 0.37*S^2
  + 30.43*S*G*(1 - 1.133 / (1 - 1.056^(100*G + 43)))
```

Where:

- `S` is speed in m/s
- `G` is decimal grade

### TypeScript

```ts
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

export function re3HillSpeedFromFlatSpeed(
  flatSpeedMps: number,
  gradePct: number
): number {
  const target = re3Demand(flatSpeedMps, 0);

  return bisect(
    (vh) => re3Demand(vh, gradePct) - target,
    0.2,
    15
  );
}
```

### Notes

- Promising modern metabolic model
- Intended to improve both uphill and downhill handling
- Must be labeled reconstructed

---

## 6) Running Writings

### Category
`metabolic_equivalent`

### Kind
`demand_model`

### Provenance
`source-code`

### Important note

This is not a single grade-only formula.

It uses:

1. a Black et al. flat-running baseline
2. a Minetti grade delta without intercept
3. inverse solve back to equivalent flat speed

### Formula structure

Grade delta:

```text
deltaEC(g) =
  155.4*g^5 - 30.4*g^4 - 43.3*g^3 + 46.3*g^2 + 19.5*g
```

Where `g` is decimal grade.

Hill demand:

```text
Demand_hill(v, g) = Black(v) + v * deltaEC(g)
```

Equal-effort condition:

```text
Black(v_hill) + v_hill*deltaEC(g) = Black(v_flat)
```

### Implementation requirements

- load `black_data_gam.json`
- interpolate `Black(v)`
- solve `v_hill` numerically

### TypeScript

```ts
export interface BlackCurve {
  speed_m_s: number[];
  energy_j_kg_s: number[];
}

export function deltaEC(gradePct: number): number {
  const g = gradePct / 100;
  return (
    155.4 * g ** 5 -
    30.4 * g ** 4 -
    43.3 * g ** 3 +
    46.3 * g ** 2 +
    19.5 * g
  );
}

export function interpMonotone(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];

  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const x1 = xs[i - 1];
      const x2 = xs[i];
      const y1 = ys[i - 1];
      const y2 = ys[i];
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }

  throw new Error("Interpolation failed");
}

export function runningWritingsDemand(
  speedMps: number,
  gradePct: number,
  black: BlackCurve
): number {
  const base = interpMonotone(black.speed_m_s, black.energy_j_kg_s, speedMps);
  return base + speedMps * deltaEC(gradePct);
}

export function runningWritingsHillSpeedFromFlatSpeed(
  flatSpeedMps: number,
  gradePct: number,
  black: BlackCurve
): number {
  const target = runningWritingsDemand(flatSpeedMps, 0, black);

  return bisect(
    (vh) => runningWritingsDemand(vh, gradePct, black) - target,
    0.2,
    15
  );
}
```

### Notes

- Speed-dependent
- Very good candidate model
- Similar in spirit to modern metabolic-equivalent pacing

---

## 7) HillRunner

### Category
`empirical_flat_equivalent`

### Kind
`empirical_interpolation` or `direct_multiplier`

### Important note

HillRunner explicitly says its published conversion chart is not based on a formula.

So implement two modes:

1. **preferred:** table interpolation
2. **optional:** surrogate formula

### 7A) HillRunner table mode

Use the published chart as lookup data and interpolate between pace and incline.

### 7B) HillRunner surrogate formula

Use this fitted approximation:

```text
E = 0.05631 + 1.03201*p + 0.27534*g - 0.01429*g^2 - 0.07803*g*p + 0.003262*g^2*p
```

Where:

- `E` = equivalent flat pace in min/mi
- `p` = treadmill pace in min/mi
- `g` = incline in percent

To solve for treadmill pace from flat-equivalent pace:

```text
p =
  (E - (0.05631 + 0.27534*g - 0.01429*g^2))
  /
  (1.03201 - 0.07803*g + 0.003262*g^2)
```

### Renormalized multiplier mode

If a user wants a Strava-like curve with `0% = 1.0`, define:

```text
M_raw(p, g) = p / E
M_norm(p, g) = M_raw(p, g) / M_raw(p, 0)
```

### TypeScript

```ts
export function hillRunnerEquivalentFlatPace(
  treadmillPaceMinPerMile: number,
  gradePct: number
): number {
  const p = treadmillPaceMinPerMile;
  const g = gradePct;

  return (
    0.05631 +
    1.03201 * p +
    0.27534 * g -
    0.01429 * g * g -
    0.07803 * g * p +
    0.003262 * g * g * p
  );
}

export function hillRunnerRenormalizedMultiplier(
  refPaceMinPerMile: number,
  gradePct: number
): number {
  const E = hillRunnerEquivalentFlatPace(refPaceMinPerMile, gradePct);
  const E0 = hillRunnerEquivalentFlatPace(refPaceMinPerMile, 0);

  const raw = refPaceMinPerMile / E;
  const raw0 = refPaceMinPerMile / E0;

  return raw / raw0;
}
```

### Notes

- Pace-dependent
- Treadmill-specific
- Not a universal hill-running theory

---

## 8) van Dijk & van Megen ECOR hill formula

### Category
`metabolic_equivalent`

### Kind
`direct_multiplier`

### Naming rule

Always call this:

**van Dijk & van Megen ECOR hill formula**

Do **not** call it “Stryd ECOR”.

### Formula

```text
ECOR = 0.98 + (i/100) * 9.81 * (45.6 + 1.16*i) / 100
```

Where:

- `i` = grade in percent

Normalize to get multiplier:

```text
M(i) = ECOR(i) / 0.98
```

### TypeScript

```ts
export function ecorMultiplier(gradePct: number): number {
  const i = gradePct;
  const ecor =
    0.98 + (i / 100) * 9.81 * (45.6 + 1.16 * i) / 100;

  return ecor / 0.98;
}
```

### Notes

- Simple direct multiplier
- Easy to implement
- Publicly documented formula

---

## 9) Personal Stryd-like uphill curve

### Category
`power_equivalent`

### Kind
`demand_model`

### Provenance
`user-inferred`

### Important note

Do **not** claim this is Stryd’s official public formula.

This is a personal empirical fit from one treadmill experiment.

### Formula

```text
M(g) = 1 + 0.04305*g + 0.0008379*g^2
```

Where `g` is in percent.

### Validity

- intended only for roughly `0% to 20%` uphill
- should not be used for pace planning unless the user provides a flat power-speed curve

### Required logic

If the user provides `P_flat(v)`, solve:

```text
P_flat(v_hill) * M(g) = P_flat(v_flat)
```

### TypeScript

```ts
export function personalStrydLikeMultiplier(gradePct: number): number {
  return 1 + 0.04305 * gradePct + 0.0008379 * gradePct ** 2;
}

export function personalStrydLikeHillSpeedFromFlatSpeed(
  flatSpeedMps: number,
  gradePct: number,
  userPowerCurve: (speedMps: number) => number
): number {
  const targetPower = userPowerCurve(flatSpeedMps);
  const mult = personalStrydLikeMultiplier(gradePct);

  return bisect(
    (vh) => userPowerCurve(vh) * mult - targetPower,
    0.2,
    15
  );
}
```

### Notes

- only enable if `userPowerCurve` exists
- otherwise show disabled / unavailable

---

# Models to list but not implement exactly

## Stryd official
Category: `unavailable`

Do not claim an exact public hill formula.

## COROS Effort Pace
Category: `unavailable`

Do not claim an exact public formula.

## PickleTech individualized GAP
Category: `unavailable`

Conceptual placeholder unless historical user data and fitting pipeline exist.

## runbundle exact formula
Category: `unavailable`

Do not claim exact implementation unless separately reverse-engineered.

---

# Suggested UI grouping

## Metabolic-equivalent models
- Minetti
- ACSM
- Updated HTK
- Updated RE3 (reconstructed)
- Running Writings
- van Dijk & van Megen ECOR hill formula

## Empirical flat-equivalent models
- Strava GAP (user-inferred interpolation)
- HillRunner (table interpolation)
- HillRunner (surrogate formula)
- HillRunner (renormalized multiplier)

## Power-equivalent models
- Personal Stryd-like uphill curve

## Unavailable / proprietary / explanatory only
- Stryd official
- COROS Effort Pace
- PickleTech individualized GAP
- runbundle exact

---

# Validation tests

Write tests for all models.

## Shared tests
- flat normalization should satisfy `M(0) ≈ 1` for any normalized multiplier model
- every model should return finite numbers in its declared domain
- every model should advertise its supported range and downhill support correctly

## Model-specific tests

### Minetti
- `minettiMultiplier(0) === 1` within tolerance
- multiplier decreases on moderate downhills, then rises again on steeper downhills

### Strava inferred
- around `-9%` to `-10%`, multiplier is near `0.88`
- by about `-18%`, multiplier is back near `1.0`
- `M(0)` is approximately `1`

### ACSM
- `M(0) === 1`
- uphill is monotone increasing
- downhill linear extrapolation is marked as simplistic

### Updated HTK
- `M(0) === 1`
- uphill monotone increasing in supported range

### Updated RE3
- `M(0) === 1`
- J-shaped behavior across downhill and uphill
- label includes reconstruction warning

### HillRunner raw
- `0%` should **not** equal `1.0`

### HillRunner renormalized
- `0%` **should** equal `1.0`

### Personal Stryd-like
- valid only over `0..20%` unless user explicitly enables extrapolation
- disabled if no `userPowerCurve` exists

---

# Required warnings in the UI

## Strava inferred
"This is a user-inferred approximation from digitized public graph data, not the official Strava production formula."

## Updated RE3
"This implementation is reconstructed from OCR / PDF text and may not be character-perfect versus the typeset manuscript."

## HillRunner surrogate
"HillRunner’s published chart is not formula-based. This is an approximate fit to the published table."

## Personal Stryd-like
"This is a personal empirical uphill fit, not Stryd’s official public hill formula."

---

# Output helpers

Implement utility conversions:

```ts
export function speedMpsToPaceSecPerKm(speedMps: number): number {
  return 1000 / speedMps;
}

export function paceSecPerKmToSpeedMps(paceSecPerKm: number): number {
  return 1000 / paceSecPerKm;
}

export function paceSecPerMileToSpeedMps(paceSecPerMile: number): number {
  return 1609.344 / paceSecPerMile;
}

export function speedMpsToPaceSecPerMile(speedMps: number): number {
  return 1609.344 / speedMps;
}
```

---

# Recommendation for defaults

Use these defaults in the UI:

- default model: `Strava GAP (user-inferred interpolation)`
- advanced options:
  - Minetti
  - Updated HTK
  - Updated RE3 (reconstructed)
  - Running Writings
  - ACSM
  - HillRunner
  - van Dijk & van Megen ECOR hill formula
  - Personal Stryd-like uphill

---

# Nice-to-have future features

- Allow a user-provided gradient-speed mapping table in the form of `[gradePct, multiplier]` points. Use linear interpolation inside the provided range. Choose the model to fall-back to outside of that range.
- user-calibrated flat power-speed curve editor
- individualized GAP fitter from historical runs
- model overlay chart in-app
- compare selected models side by side
- section-level equal-effort planning between race cutoffs
- downhill cap / realism limiter
- terrain technicality penalty
- heat / altitude adjustments
