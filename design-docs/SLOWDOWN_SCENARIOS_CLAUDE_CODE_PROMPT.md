
# Claude Code Prompt — Slowdown Scenario Module for the Race-Plan Calculator

You are helping me extend an existing race-plan calculator that already generates an **equal-effort pacing plan** for a hilly course.

The existing calculator already does things like:

- ingest a course file (GPX and/or TCX)
- let the user choose a target finish time
- let the user choose a hill model that converts gradient to equal-effort pace
- optionally incorporate aid stations, cutoffs, and dwell times
- generate pacing outputs at multiple resolutions:
  - microsegment
  - mile / kilometer
  - aid station / checkpoint
  - climb summary
- support section-level optimization, not just one whole-course global solve

## What I want you to build now

Add a **slowdown scenario system** that can be layered on top of the equal-effort baseline plan.

The goal is **not** to build a medically or physiologically predictive bonk model. The goal is to let the user choose an **explainable, scenario-based late-race slowdown pattern** and see how it changes splits, checkpoint arrivals, climb summaries, and finish time.

This should be implemented as a modular subsystem that can be cleanly composed with the existing equal-effort pacing engine.

---

## Design philosophy

Please follow these principles closely:

1. **Equal-effort baseline first, slowdown overlay second**
   - First compute the baseline equal-effort pacing plan using the chosen hill model and target time.
   - Then apply the slowdown scenario as an overlay on top of the baseline pacing plan.

2. **Scenario-based, not pseudo-scientific**
   - Do not pretend this predicts the future.
   - Treat slowdown as a deterministic scenario generator with transparent parameters.

3. **Monotone slowdown assumption**
   - For this implementation, assume the user is trying to hold pace for as long as humanly possible.
   - Once a meaningful slowdown begins, do **not** model a full recovery back to baseline pace later.
   - Slowdown should be monotone nondecreasing after onset, except for an optional tiny finish kick in non-wall scenarios if that is easy to support.

4. **Late-race emphasis**
   - Ordinary fades should usually begin in the late race.
   - True wall / collapse scenarios should be concentrated in the final 10–17 km unless the user explicitly picks an earlier blow-up scenario.

5. **Explainability over cleverness**
   - Favor simple, transparent formulas and user-visible parameters.
   - Every scenario should be describable in plain language:
     - when slowdown starts
     - how much slower it gets
     - how quickly it ramps in
     - whether it persists to the finish

6. **Safe defaults**
   - Default behavior should be honest and conservative.
   - The safest default mode is:
     - compute the target-based equal-effort plan
     - overlay the chosen slowdown
     - report the slower projected finish time
   - An optional “compensate to still hit target” mode is allowed, but it must be clearly labeled and implemented carefully.

---

## Evidence-informed assumptions to encode

Use these as conceptual guidance for the scenario presets and docs:

- Marathon pacing studies commonly categorize pacing as **positive**, **even**, or **negative**, with positive pacing being most common.
- Faster runners tend to pace more evenly than slower runners.
- In segment-based marathon studies, the biggest slowdown often appears in the **30–40 km** segment.
- “Hitting the wall” can be thought of as a distinct late-race sustained slowdown, often after ~20 miles / ~32 km.
- For this module, we are intentionally using a simplified assumption:
  - runners hold pace as long as possible,
  - then slow,
  - and do not fully recover.

Do **not** hard-code shaky claims that are not supported by the prompt. Keep the implementation modest and scenario-driven.

---

## High-level product behavior

The user should be able to choose:

- **No slowdown**
- **A preset slowdown scenario**
- **A custom slowdown scenario**

The engine should then:

- apply slowdown at the microsegment level
- recompute all downstream summaries and split tables
- show baseline vs slowdown-adjusted outputs
- make the finish-time consequence obvious

---

## Core terminology

Please use consistent internal terminology:

- **baseline plan**: the equal-effort plan before slowdown
- **slowdown scenario**: the user-selected overlay
- **onset distance**: where slowdown begins
- **ramp distance**: distance over which slowdown ramps from 0 to its target level
- **slowdown fraction**: fractional increase in pace vs baseline  
  - example: `0.08` means 8% slower than baseline pace
- **plateau slowdown**: target slowdown level after ramp-in
- **persistence**: whether slowdown continues to finish
- **adjusted plan**: baseline plan after slowdown overlay
- **forecast mode**: target baseline, then show slower finish if slowdown occurs
- **compensate mode**: solve for a faster internal baseline plan so that after slowdown the adjusted plan still finishes at the user’s requested target

Use these terms in code, comments, docs, and UI labels when reasonable.

---

## Slowdown should operate on pace, not distance

At the microsegment level, the equal-effort engine will already produce something like:

- distance
- grade
- baseline pace
- baseline segment time

The slowdown overlay should multiply pace (or segment time equivalently).

Example:

- baseline pace = `8:00 / mi`
- slowdown fraction = `0.10`
- adjusted pace = `8:48 / mi`

Mathematically:

- `adjusted_pace = baseline_pace * (1 + slowdown_fraction_at_distance)`
- equivalently:
- `adjusted_segment_time = baseline_segment_time * (1 + slowdown_fraction_at_distance)`

The slowdown should **not** change the hill model itself.
It is an overlay after the equal-effort pace has already been determined.

---

## Required scenario presets

Please implement the following presets.

### 1. No slowdown
- onset: none
- slowdown fraction: 0
- used as control / baseline

### 2. Controlled / tiny late fade
Intended for a very well-executed day.

Suggested default behavior:
- onset bucket: `35–40 km`
- plateau slowdown: `0.01–0.03`
- ramp distance: `2–5 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `37 km`
- plateau slowdown `0.02`
- ramp distance `3 km`

### 3. Gentle late fade
A realistic mild fade late in the race.

Suggested default behavior:
- onset bucket: `30–35 km`
- plateau slowdown: `0.03–0.08`
- ramp distance: `3–5 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `32 km`
- plateau slowdown `0.05`
- ramp distance `4 km`

### 4. Moderate late fade
A stronger but still plausible late fade.

Suggested default behavior:
- onset bucket: `30–35 km`
- plateau slowdown: `0.08–0.15`
- ramp distance: `3–5 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `31 km`
- plateau slowdown `0.10`
- ramp distance `4 km`

### 5. Wall-lite
A clear late-race crack that is worse than ordinary fade but not catastrophic.

Suggested default behavior:
- onset bucket: `30–35 km`
- plateau slowdown: `0.15–0.25`
- ramp distance: `2–4 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `31 km`
- plateau slowdown `0.20`
- ramp distance `3 km`

### 6. Classic wall
A substantial late-race sustained slowdown.

Suggested default behavior:
- onset bucket: `30–35 km`
- plateau slowdown: `0.25–0.40`
- ramp distance: `2–4 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `30 km`
- plateau slowdown `0.30`
- ramp distance `3 km`

### 7. Early blow-up
An overly aggressive day where slowdown starts too early.

Suggested default behavior:
- onset bucket: `25–30 km`
- plateau slowdown: `0.20–0.40`
- ramp distance: `2–5 km`
- persists to finish

Choose a sensible deterministic default, for example:
- onset at `27 km`
- plateau slowdown `0.25`
- ramp distance `4 km`

---

## Required custom scenario support

The user must also be able to define a custom slowdown scenario directly.

At minimum, the custom scenario should accept:

- `onset_distance`
- `plateau_slowdown_fraction`
- `ramp_distance`
- `persist_to_finish` (default true)

Optional advanced parameters are fine if easy, but not required.

If you want to support a tiny optional finish kick for non-wall scenarios, make it opt-in and keep it very small.
Do not let it violate the core monotone assumption unless clearly separated as an optional overlay.

---

## Core slowdown function

Implement slowdown as a simple piecewise function of cumulative distance.

Let:

- `d` = cumulative distance along course
- `d_on` = onset distance
- `d_ramp` = ramp distance
- `s_max` = plateau slowdown fraction

Then a good default is:

- `s(d) = 0` for `d < d_on`
- linearly ramp from `0` to `s_max` over `[d_on, d_on + d_ramp]`
- `s(d) = s_max` for `d >= d_on + d_ramp`

In pseudocode:

```text
if d < d_on:
    s = 0
elif d < d_on + d_ramp:
    s = s_max * (d - d_on) / d_ramp
else:
    s = s_max
```

That is the default model I want unless the codebase already strongly suggests a better equally simple shape.
If you choose a logistic or smoothstep ramp, only do so if it stays easy to explain and test.

---

## Two required operating modes

### Mode A: forecast mode
This should be the default.

Behavior:
- solve the baseline equal-effort plan for the user’s requested target finish time
- apply the slowdown scenario afterward
- report the adjusted finish time and all adjusted splits

Interpretation:
- “If you pace for this target and this slowdown happens, here is what your day looks like.”

### Mode B: compensate-to-target mode
This should be optional.

Behavior:
- solve for an **internal faster baseline target** such that, after applying the slowdown scenario, the adjusted plan finishes at the user’s requested finish time
- preserve the equal-effort shape of the underlying pacing engine
- do **not** manually “bank time” with ad hoc early split hacks
- instead, treat this as a root-finding problem on the baseline target time

Important:
- this mode should be clearly labeled as a planning assumption
- add guardrails so it does not produce absurd internal targets without warning

Suggested approach:
1. user requests final target `T_user`
2. choose slowdown scenario `S`
3. define a function:
   - `F(T_internal) = adjusted_finish_time_after_overlay(T_internal, S) - T_user`
4. solve for `T_internal` using a robust numeric method such as bisection
5. if the required `T_internal` is implausibly fast relative to `T_user`, issue a warning

This is the cleanest way to incorporate slowdown while preserving the equal-effort engine.

---

## Integration requirements

Please integrate the slowdown system so that it works with all existing output resolutions.

### Microsegment output
For each microsegment include:

- cumulative distance
- grade
- baseline pace
- slowdown fraction
- adjusted pace
- baseline segment time
- adjusted segment time
- time delta from slowdown

### Mile / kilometer output
Aggregate and report:

- baseline split
- adjusted split
- split delta
- cumulative baseline time
- cumulative adjusted time

### Aid station / checkpoint output
If aid stations / checkpoints already exist in the codebase, report:

- baseline arrival
- adjusted arrival
- arrival delta
- baseline departure if dwell exists
- adjusted departure if dwell exists

Important:
- slowdown applies to **moving pace**
- aid station dwell is separate
- dwell itself should not be multiplied by slowdown unless there is already a distinct existing concept for that

### Climb summary output
For each climb summary include:

- baseline climb time
- adjusted climb time
- climb time delta
- note whether the climb occurs pre-onset, during ramp, or post-onset

This is important because some users will want to see how a late-race fade changes the big climbs specifically.

---

## Section-level optimization compatibility

The calculator already supports section-level optimization.
Please make the slowdown module compatible with that architecture.

At minimum:

- slowdown overlay must work regardless of whether the baseline plan was solved globally or section-by-section
- slowdown should be computed using cumulative course distance, not local section distance, unless the sectioning system explicitly requires otherwise

If the architecture allows it cleanly, add support for section-local slowdown summaries, but do not make that a blocker.

---

## Validation and edge cases

Please handle these carefully.

### Distance edge cases
- If onset is beyond course finish, slowdown should never activate.
- If onset is before course start, clamp it to course start.
- If ramp distance is zero, treat slowdown as an immediate step change.
- If onset + ramp extends past finish, ramp only over the remaining course distance.

### Value validation
- onset distance must be nonnegative
- ramp distance must be nonnegative
- plateau slowdown fraction must be nonnegative
- plateau slowdown fraction above something like `0.75` should probably be rejected or at least strongly warned on

### Unit handling
- Be explicit about units everywhere.
- Distances may come in kilometers or miles depending on the app, but internal calculations should be consistent.

### Aid stations
- Dwell times should remain separate from pace slowdown.

### Very short races
- If the tool is used on shorter distances, the slowdown presets may become nonsensical.
- Build in a mechanism to:
  - warn
  - adapt
  - or disable certain presets when course length is too short for them to make sense

For example:
- a “classic wall” preset probably should not be blindly applied to a 10K.

---

## Data model suggestions

Please implement a clear configuration object for slowdown.

Something roughly like:

```ts
type SlowdownMode = "forecast" | "compensate_to_target";

type SlowdownPreset =
  | "none"
  | "controlled_late_fade"
  | "gentle_late_fade"
  | "moderate_late_fade"
  | "wall_lite"
  | "classic_wall"
  | "early_blowup"
  | "custom";

interface SlowdownScenarioConfig {
  preset: SlowdownPreset;
  mode: SlowdownMode;
  onsetDistance?: number;
  rampDistance?: number;
  plateauSlowdownFraction?: number;
  persistToFinish?: boolean;
  enableFinishKick?: boolean;
  finishKickFraction?: number;
  finishKickDistance?: number;
}
```

You do not have to use exactly these names, but keep the structure close to this.

---

## Output / API expectations

Please expose enough information so that the frontend or CLI can easily show:

- chosen scenario preset
- scenario parameters actually used
- baseline finish time
- adjusted finish time
- total slowdown time cost
- where slowdown began
- max slowdown fraction reached

If compensate-to-target mode is used, also expose:

- user requested target finish time
- internally solved baseline target finish time
- warning flags if compensation required an aggressive internal target

---

## Required documentation / UX copy

Please add concise user-facing descriptions for the presets.

Use plain language.

Examples:

- **No slowdown** — No late-race fade is applied.
- **Controlled / tiny late fade** — A very small slowdown late in the race.
- **Gentle late fade** — A mild slowdown beginning near the final 10–12 km.
- **Moderate late fade** — A noticeable slowdown beginning near the final 10–12 km.
- **Wall-lite** — A distinct late-race crack that persists to the finish.
- **Classic wall** — A major late-race slowdown that persists to the finish.
- **Early blow-up** — A too-fast day where slowdown begins earlier than ideal.

Also document the two modes clearly:

- **Forecast mode** — Keep the target-based pacing plan and show how slowdown affects the final result.
- **Compensate-to-target mode** — Solve a faster underlying plan so that after slowdown the final result still lands on the requested target.

---

## Tests I want

Please add tests for at least the following.

### Unit tests
- no slowdown leaves baseline unchanged
- slowdown begins exactly at onset
- ramp behaves correctly
- plateau behaves correctly
- slowdown never decreases after onset in the default model
- onset beyond finish never activates
- zero ramp behaves as step change
- adjusted finish time is slower than baseline in forecast mode when slowdown > 0

### Compensate mode tests
- root-finding converges
- adjusted finish time lands close to requested target
- internal baseline target is faster than requested target when slowdown > 0
- warnings are surfaced when compensation is extreme

### Aggregation tests
- mile / km tables reflect microsegment slowdown correctly
- aid station arrivals reflect adjusted movement time plus unchanged dwell
- climb summaries correctly classify pre-onset / ramp / post-onset

---

## Implementation guidance

Please inspect the existing codebase and integrate the slowdown module in the most natural place.

I would like:

1. a clean scenario config type
2. a pure function that maps cumulative distance to slowdown fraction
3. a pure function that applies slowdown to baseline microsegments
4. clear aggregation updates for mile/km, aid station, and climb summaries
5. optional compensate-to-target logic implemented as a wrapper around the existing baseline solver
6. tests
7. concise docs

Please avoid entangling slowdown logic with GPX/TCX parsing or hill-model math unless necessary.

---

## Non-goals

Please do **not** do these unless I explicitly ask later:

- do not build a machine-learning bonk predictor
- do not overfit to a specific paper’s dataset
- do not make sex-specific or age-specific slowdown assumptions
- do not invent unsupported physiology
- do not add randomness unless clearly optional
- do not replace the equal-effort solver with a fatigue model

This is a deterministic planning feature, not a scientific claim about what will happen.

---

## Nice-to-have ideas if easy

Only do these if they are genuinely easy and do not distract from the core implementation:

- allow the user to choose onset by bucket label like `30–35 km` instead of exact number
- show baseline vs adjusted cumulative time chart
- show where slowdown begins on the elevation profile
- add a warning if the chosen slowdown scenario conflicts badly with the target or cutoffs
- support “custom scenario from JSON”

---

## Deliverables

Please produce:

1. code changes implementing the slowdown scenario system
2. tests
3. updated docs / README or equivalent
4. a short implementation note summarizing:
   - where the logic lives
   - how the scenario model works
   - what assumptions were made
   - any open questions or recommended future extensions

If there are multiple reasonable ways to integrate this, choose the simplest clean design and explain the tradeoffs briefly.

---

## Final reminder

Please optimize for:

- correctness
- clarity
- modularity
- explainability
- easy future extension

The core mental model should remain:

> Equal-effort baseline first.  
> Slowdown scenario overlay second.  
> Then regenerate all downstream outputs.
