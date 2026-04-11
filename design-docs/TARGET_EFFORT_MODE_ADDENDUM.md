# TARGET_EFFORT_MODE_ADDENDUM.md

## Purpose

This addendum defines a second planning mode for the race-plan calculator:

- **Target time mode**: the user supplies a target finish time
- **Target effort mode**: the user supplies a flat pace (or flat speed) representing the effort they want to hold

In **Target effort mode**, the calculator should:

- accept a **flat-equivalent pace** as input
- convert that flat-equivalent pace into the equivalent pace for each segment based on the selected hill model
- compute the resulting projected elapsed time over the full course
- compute projected ETAs at miles, checkpoints, and aid stations
- optionally compare those ETAs against cutoffs

This mode is useful for questions like:

- “If I can hold 12:30/mi flat-equivalent effort, what does that imply on this course?”
- “What overall finish time would this effort produce?”
- “Would this effort be enough to make the cutoffs?”

---

## High-level behavior

### Target effort mode input
The user supplies:

- a **flat-equivalent pace** (for example `12:30/mi` or `7:46/km`)
- a course file
- a hill model
- optional checkpoints, cutoffs, dwell times, and penalties

### Target effort mode output
The calculator returns:

- segment-by-segment target paces
- projected total finish time
- projected mile/km splits
- projected aid-station ETAs
- projected buffers vs cutoff
- projected climb times

### Key conceptual difference from target time mode

In **target time mode**:
- solve for the flat-equivalent pace/speed that makes total time match the target finish time

In **target effort mode**:
- the flat-equivalent pace/speed is already given
- no outer solve is needed
- simply propagate that effort through the course using the chosen model

---

# 1) User inputs for Target effort mode

## Required inputs

### A. Planning mode
User must choose:
- `target_time`
- `target_effort`

### B. Flat-equivalent effort input
User must provide one of:

- flat-equivalent pace
- flat-equivalent speed

Preferred UI:
- pace entry field
- optional toggle for pace vs speed

Accepted formats:
- `m:ss /mi`
- `m:ss /km`
- numeric speed in mph, kph, or m/s

Examples:
- `12:30 /mi`
- `7:46 /km`
- `6.0 mph`

### C. Course data
Same as the main calculator:
- GPX and/or TCX

### D. Hill model selection
Same supported model list as main calculator.

---

## Optional inputs

All existing optional inputs from `RACE_PLAN_CALCULATOR_SPEC.md` should still apply, including:

- checkpoints / aid stations
- cutoffs
- dwell times
- downhill realism cap
- terrain technicality penalties
- elevation smoothing
- segment granularity
- personal power-speed curve
- reference pace where required by a pace-dependent model

---

# 2) Core computational rule

Let:

- `P_flat` = flat-equivalent pace
- `V_flat` = flat-equivalent speed
- `g_i` = segment grade
- `d_i` = segment distance

Then the calculator should compute each segment pace or speed directly from the chosen model.

---

# 3) Solve rules by model category

## A. Direct multiplier models

If the model returns:

`M(g)`

then:

```text
segment pace = flat-equivalent pace × M(g)
```

and:

```text
segment time = segment distance × segment pace
```

Whole-course total:

```text
projected finish time = sum(segment time)
```

### Direct multiplier examples
- Minetti
- Strava GAP (user-inferred)
- van Dijk & van Megen ECOR hill formula
- Updated HTK if implemented as a direct multiplier
- simple personal Stryd-like uphill
- HillRunner renormalized multiplier mode

---

## B. Demand models

If the model defines:

`D(speed, grade)`

then use the user’s flat-equivalent speed as the effort anchor.

For each segment, solve:

```text
D(v_hill, g_i) = D(v_flat, 0)
```

Then:

```text
segment time = segment distance / v_hill
```

Whole-course total:

```text
projected finish time = sum(segment time)
```

### Demand model examples
- ACSM
- Updated RE3
- Running Writings
- personal Stryd-like with user power curve

### Important note
In target effort mode, demand models still require the **inner hill-speed solve**.

But unlike target time mode, there is **no outer solve**, because `v_flat` is already supplied by the user.

---

## C. Interpolation / table models

### Grade-only interpolation
If interpolation yields a multiplier by grade only:
- treat like a direct multiplier model

### Pace-dependent interpolation tables
If the model depends on both pace and grade:
- interpolate using the user’s flat-equivalent pace or reference pace
- then derive the equivalent hill pace
- then compute segment time

### Examples
- HillRunner official table
- any future user-uploaded calibration table

---

## D. Proprietary / unavailable models

If a model is marked unavailable:
- do not allow exact solve
- show an explanation
- optionally suggest the closest public approximation

Examples:
- Stryd official
- COROS Effort Pace
- PickleTech individualized GAP

---

# 4) Required formulas for target effort mode

## 4.1 Pace-to-speed conversion
Internally, all demand-model solves should use speed.

Use:

```ts
export function paceSecPerMileToSpeedMps(paceSecPerMile: number): number {
  return 1609.344 / paceSecPerMile;
}

export function speedMpsToPaceSecPerMile(speedMps: number): number {
  return 1609.344 / speedMps;
}
```

Equivalent metric helpers should also exist.

---

## 4.2 Direct multiplier projection

If the user enters a flat-equivalent pace `P_flat`:

```text
P_i = P_flat × M(g_i)
t_i = d_i × P_i
T_total = sum(t_i)
```

This is the simplest target-effort projection.

---

## 4.3 Demand-model projection

If the user enters flat-equivalent speed `V_flat`:

For each segment solve:

```text
D(V_i, g_i) = D(V_flat, 0)
```

Then:

```text
t_i = d_i / V_i
T_total = sum(t_i)
```

If the user entered pace instead of speed:
- convert pace to speed first
- solve
- convert hill speeds back to paces for display

---

# 5) Output requirements in Target effort mode

All the normal output tables should still exist, but their interpretation changes slightly.

## A. Summary output
Must include:

- selected model
- input flat-equivalent pace
- projected finish time
- projected average pace
- projected weighted distance or equivalent demand summary

## B. Segment table
Must include:

- segment distance
- grade
- segment target pace
- segment time
- cumulative elapsed

## C. Mile / kilometer table
Must include:

- mile or kilometer marker
- projected pace for that interval
- projected elapsed time

## D. Checkpoint table
If checkpoints exist:

| Checkpoint | Distance | Projected ETA | Cutoff | Buffer vs cutoff | Planned dwell | Depart ETA |
|---|---:|---:|---:|---:|---:|---:|

## E. Climb table
Must include:

- climb start/end
- projected average climb pace
- projected climb time

---

# 6) Cutoff handling in Target effort mode

## If cutoffs are provided
The app should compare the projected ETAs against each cutoff.

For each checkpoint, compute:

```text
buffer = cutoff_time - projected_arrival_time
```

Interpretation:
- positive buffer = ahead of cutoff
- negative buffer = projected miss

### UI behavior
Use clear labeling:
- “Projected arrival”
- “Cutoff”
- “Ahead by”
- “Behind by”

## If no cutoffs are provided
Do not show cutoff buffer columns.

---

# 7) Dwell times in Target effort mode

Dwell times should still be supported.

If a checkpoint has a dwell time:
- arrival ETA is computed from the course pacing
- departure ETA = arrival ETA + dwell
- downstream cumulative ETAs must include the dwell

Projected finish time must include total dwell.

---

# 8) Downhill caps and terrain penalties

Target effort mode must still allow the same realism adjustments as target time mode.

Apply them **after** the raw model pace is computed for a segment.

Examples:
- downhill speed cap
- technical terrain slowdown
- section-specific penalties

Order of operations:
1. compute raw segment pace from selected model
2. apply realism caps / penalties
3. compute final segment time
4. accumulate elapsed times

---

# 9) UI requirements for Target effort mode

## Main input behavior
When the user selects `Target effort mode`:

- hide or disable target finish time input
- show flat-equivalent pace/speed input
- keep course upload and model selection visible

## Labeling
Use clear language like:

- “Flat-equivalent pace”
- “Equivalent flat pace you can hold at target effort”
- “Projected finish time from this effort”

Avoid ambiguous language like:
- “goal pace”
- “race pace”
unless clearly defined

---

# 10) Validation tests

Add the following tests.

## Direct multiplier target effort tests
- if `M(0) = 1`, then a flat segment should use the same pace as the input flat pace
- uphill segments should be slower than flat for positive grades
- projected finish time should equal the sum of segment times

## Demand-model target effort tests
- for flat segments, solved hill speed at `g = 0` should equal `v_flat`
- no outer solve should run in target effort mode
- projected finish time should equal the sum of segment times

## Checkpoint tests
- checkpoint ETAs should be monotone increasing
- cutoff buffers should be computed correctly
- dwell times should shift downstream ETAs

---

# 11) Recommended implementation hooks

Add a planning mode enum:

```ts
export type PlanningMode = "target_time" | "target_effort";
```

Add an effort input object:

```ts
export interface TargetEffortInput {
  flatEquivalentPaceSecPerMile?: number;
  flatEquivalentPaceSecPerKm?: number;
  flatEquivalentSpeedMps?: number;
}
```

At runtime:

- if `planningMode === "target_time"`:
  - run existing target-time solver
- if `planningMode === "target_effort"`:
  - skip the outer solve
  - propagate the given flat effort through the course

---

# 12) Definition of done for Target effort mode

Target effort mode is done when the calculator can:

- accept a flat-equivalent pace or speed
- propagate that effort through the chosen hill model
- compute projected segment paces
- compute projected total finish time
- compute projected mile-by-mile splits
- compute projected checkpoint ETAs
- compare projected ETAs to cutoffs if present
- include dwell times and realism penalties
- clearly distinguish this mode from target finish-time solving
