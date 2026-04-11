# RACE_PLAN_CALCULATOR_SPEC.md

## Goal

Build a race-plan calculator that generates an **equal-effort pacing plan** for a hilly course.

The calculator should:

- ingest a course file (GPX and/or TCX)
- let the user choose a hill model
- let the user choose a target finish time
- optionally incorporate aid stations, cutoffs, and dwell times
- generate pacing outputs at multiple resolutions:
  - microsegment
  - mile / kilometer
  - aid station / checkpoint
  - climb summary
- support section-level optimization, not just one whole-course global solve

This spec focuses on the **product behavior, user inputs, outputs, and calculation flow**.

Use `HILL_MODELS_SPEC.md` as the companion document for the hill-model formulas and solver details.

---

## Product concept

The calculator should answer questions like:

- “What pace should I run each mile if I want to finish in 14:00?”
- “How do the paces change if I choose Minetti vs Strava GAP?”
- “How fast do I need to move within each cutoff window?”
- “What is my ETA at each aid station?”
- “Where are the major climbs and what pace should I expect on them?”

The app should support both:

1. **whole-course equal-effort planning**
2. **section-level equal-effort planning**
   - for example, each cutoff-to-cutoff section is solved independently

---

# 1) User inputs

## 1.1 Required inputs

### A. Course data
The user must provide at least one:

- GPX file
- TCX file

The calculator should accept either:
- GPX only
- TCX only
- both GPX and TCX

If both are provided:
- prefer whichever has cleaner elevation / distance data
- optionally compare and warn if they differ materially

### B. Target finish time
The user must provide a target elapsed finish time.

Accepted formats:
- `HH:MM`
- `H:MM:SS`
- total minutes as a number

Examples:
- `14:00`
- `15:30`
- `930` minutes

### C. Hill model selection
The user must choose one model from the supported set.

At minimum the UI should allow:

- Strava GAP (user-inferred interpolation)
- Minetti
- ACSM
- Updated HTK
- Updated RE3 (reconstructed)
- Running Writings
- HillRunner
- van Dijk & van Megen ECOR hill formula
- Personal Stryd-like uphill (only if calibrated inputs exist)

---

## 1.2 Optional inputs

### A. Race checkpoints / aid stations
Optional structured table:

- label
- mile/km location
- optional cutoff time
- optional planned dwell time

Example:

| Label | Distance | Cutoff | Dwell |
|---|---:|---:|---:|
| Tennessee Valley Out | 13.0 mi | 3:00 | 0:00 |
| Muir Beach In | 30.3 mi | 7:00 | 1:00 |

### B. Planning mode
The user may choose:

- whole-course equal-effort
- checkpoint-section equal-effort
- hybrid:
  - solve each cutoff section independently
  - then merge into one full pacing table

Default recommendation:
- whole-course if no checkpoints provided
- checkpoint-section if cutoffs are provided

### C. Distance units
- miles
- kilometers

### D. Pace units
- min/mile
- min/km

### E. Segment granularity
The user may choose how finely to discretize the course.

Options:
- automatic default
- fixed distance:
  - 0.05 mi
  - 0.1 mi
  - 0.25 mi
  - 100 m
  - 250 m
- fixed number of segments

Default:
- 0.1 mile or equivalent metric length

### F. Elevation smoothing
Optional smoothing choice:

- none
- light
- medium
- heavy

Default:
- light smoothing

### G. Downhill realism cap
Optional control to prevent unrealistic downhill paces.

Possible modes:
- none
- cap multiplier at grade X
- cap downhill speed increase to Y%
- cap downhill pace to no faster than user-defined pace

### H. Terrain / technicality penalty
Optional user-provided factor to slow technical sections.

Possible input forms:
- none
- uniform penalty multiplier for selected range
- section-specific pace penalty

### I. Aid-station dwell times
User may specify:
- zero dwell time
- uniform dwell time for all aid stations
- station-specific dwell times

### J. Personal calibration inputs
Optional depending on chosen model:

- personal Strava inferred points
- flat power-speed curve
- user power zones
- flat threshold pace
- speed-dependent calibration table

### K. Output resolution preferences
User may choose to generate:
- mile-by-mile only
- aid stations only
- full segment table
- all outputs

---

# 2) Derived intermediate data

The calculator should derive the following from the inputs.

## 2.1 Parsed course points
From GPX / TCX:
- latitude
- longitude
- elevation
- cumulative distance

## 2.2 Resampled course profile
After normalization / smoothing:
- evenly spaced course points
- each point has:
  - cumulative distance
  - elevation
  - local grade

## 2.3 Microsegments
The course should be split into microsegments.

Each microsegment should have:
- start distance
- end distance
- segment distance
- start elevation
- end elevation
- average grade
- net climb
- net descent

## 2.4 Checkpoint map
If checkpoints are supplied:
- assign each checkpoint to nearest course distance
- create planning sections between checkpoints

## 2.5 Major climb candidates
Derived from the course profile:
- start distance
- end distance
- total ascent
- average incline
- optional label

---

# 3) Required outputs

The app must produce the following outputs.

## 3.1 Summary output
Always show:

- selected hill model
- target finish time
- planning mode
- course length
- total climb / descent
- weighted distance or equivalent demand summary
- flat-equivalent pace or speed solved by the engine

Examples:
- weighted miles
- flat-equivalent pace
- total modeled demand ratio

---

## 3.2 Segment table
The engine-level segment table must include:

| Column | Description |
|---|---|
| segment_id | unique ID |
| start_distance | segment start |
| end_distance | segment end |
| distance | segment length |
| avg_grade_pct | average grade |
| climb_ft_m | climb in chosen units |
| descent_ft_m | descent in chosen units |
| model_multiplier_or_speed | model output |
| target_pace | target segment pace |
| target_time | target segment time |
| cumulative_elapsed | cumulative elapsed time at segment end |

This is the canonical internal output.

---

## 3.3 Mile-by-mile or kilometer-by-kilometer table
Generate a user-friendly race-plan table:

| Mile/KM | Target pace for that unit | Target elapsed |
|---:|---:|---:|

If mile splits are selected:
- compute elapsed time at each integer mile marker
- derive average pace for the interval since the prior mile marker

If km splits are selected:
- same logic for kilometer markers

---

## 3.4 Checkpoint / aid-station table
If checkpoints exist, generate:

| Checkpoint | Distance | Target ETA | Cutoff | Buffer vs cutoff | Planned dwell | Depart ETA |
|---|---:|---:|---:|---:|---:|---:|

If no cutoffs exist:
- omit cutoff and buffer columns

If dwell times exist:
- `Depart ETA = Arrival ETA + dwell`

---

## 3.5 Section summary table
If planning mode is section-based, generate:

| Section | Start | End | Distance | Time window | Weighted distance | Solved local flat-equiv pace | Avg target pace |
|---|---|---|---:|---:|---:|---:|---:|

This is essential for cutoff-based races.

---

## 3.6 Major climbs table
Generate a climb summary table:

| Climb | Start | End | Distance | Total climb | Avg incline | Avg target pace | Estimated climb time |
|---|---:|---:|---:|---:|---:|---:|---:|

If checkpoints exist, optionally split climbs at aid stations so the table is more logistics-friendly.

---

## 3.7 Visual outputs
At minimum support:

- elevation profile chart
- pace-by-distance chart
- cumulative elapsed time chart

Optional:
- model overlay chart
- checkpoint buffer chart
- climb annotations on profile

---

# 4) Core calculation pipeline

This is the required end-to-end flow.

## Step 1: Parse course file(s)
- read GPX and/or TCX
- extract track points
- compute cumulative distance if needed
- preserve elevation data

## Step 2: Clean and normalize course data
- remove duplicate points if needed
- repair tiny malformed jumps if obvious
- smooth elevation based on user setting
- compute course length

## Step 3: Resample to analysis granularity
- resample to user-selected or default segment size
- produce evenly spaced points
- compute local segment grades

## Step 4: Build planning sections
If planning mode is:
- whole-course:
  - one section = whole course
- checkpoint-section:
  - each checkpoint-to-checkpoint interval becomes a section
- hybrid:
  - use section-level solving but still produce whole-course outputs

## Step 5: Apply chosen hill model
Depending on model type:

### Direct multiplier models
For each segment:
- compute `M(gradePct)`

### Demand models
For each segment:
- solve hill speed given flat-equivalent speed target

### Table / interpolation models
- interpolate from the source data / table

## Step 6: Solve for pacing target

### Whole-course mode
Solve one flat-equivalent pace or speed such that:
- total modeled segment times sum to target finish time

### Checkpoint-section mode
For each section independently:
- section time budget = checkpoint cutoff difference or user-defined section target
- solve one local flat-equivalent pace / speed for that section
- use that pace only inside that section

## Step 7: Add dwell times
If aid-station dwell times exist:
- add them after checkpoint arrival
- recompute departure ETAs
- cumulative elapsed downstream must include dwell

## Step 8: Aggregate outputs
Roll up segment results into:
- mile/km table
- checkpoint table
- climb table
- summary metrics

## Step 9: Validate / warn
Generate warnings if:
- target requires implausible paces
- cutoffs are missed
- model chosen is outside supported grade range
- downhill cap or technicality penalty materially changes pacing
- chosen model needs calibration data that are missing

---

# 5) Exact solve rules

## 5.1 Whole-course solve for direct multiplier models
For a segment with:
- distance `d_i`
- multiplier `M_i`

Segment time:

`t_i = d_i * flatEqPace * M_i`

Total:

`targetTime = sum(d_i * flatEqPace * M_i)`

So:

`flatEqPace = targetTime / sum(d_i * M_i)`

---

## 5.2 Whole-course solve for demand models
Need an outer root solve on `flatSpeed`.

For a candidate `flatSpeed`:
- solve hill speed for each segment using the chosen model
- compute total segment times
- compare against target finish time

Use bisection or another monotone root solver.

---

## 5.3 Section-based solve
For each section:
- compute section-specific segment set
- use section time budget instead of total finish time
- solve that section independently
- concatenate all section results

---

# 6) Model-selection behavior

## 6.1 If the selected model is fully supported
Run normally.

## 6.2 If the selected model needs extra inputs
Examples:
- personal Stryd-like model needs `userPowerCurve`
- HillRunner renormalized mode needs reference pace
- Running Writings needs Black data bundle

Then:
- show required missing input
- disable run button until supplied
- or fall back to an explicit alternate mode if the user confirms

## 6.3 If the selected model is proprietary / unavailable
Show:
- explanation
- why it is unavailable
- optional nearest public approximation

Examples:
- Stryd official → suggest personal Stryd-like or van Dijk & van Megen ECOR hill formula
- COROS Effort Pace → suggest Strava inferred or individualized future mode

---

# 7) Error handling and warnings

The calculator must warn, not silently proceed, when:

- course file has no elevation data
- course file cannot be parsed
- target finish time is invalid
- checkpoint distances exceed course length
- checkpoint order is invalid
- model selected does not support downhill but course includes downhill
- grade falls outside the recommended domain of the model
- section target time is impossible or negative
- total dwell time alone causes missed cutoffs

Examples of warnings:
- “Updated HTK is intended mainly for level and uphill running.”
- “Updated RE3 is reconstructed from OCR/PDF text.”
- “HillRunner is a treadmill conversion model and is pace-dependent.”
- “Personal Stryd-like model is valid only for approximately 0–20% uphill unless you explicitly allow extrapolation.”

---

# 8) UI requirements

## 8.1 Main inputs panel
Must include:
- course upload
- target finish time
- hill model dropdown
- planning mode dropdown
- units
- segment granularity
- smoothing setting

## 8.2 Optional advanced panel
Should include:
- checkpoint editor
- dwell times
- downhill cap
- technicality penalty
- personal calibration inputs
- model notes and warnings

## 8.3 Outputs layout
Recommended output tabs:

- Summary
- Mile/KM Splits
- Checkpoints
- Sections
- Climbs
- Charts
- Raw Segments

---

# 9) File / data contracts

## 9.1 Inputs
Support:
- `.gpx`
- `.tcx`

Optional future:
- pasted checkpoint CSV
- JSON model config
- saved project file

## 9.2 Outputs
Support export to:
- CSV for mile splits
- CSV for checkpoints
- CSV for segment table
- JSON for full plan
- printable tattoo-friendly summary

---

# 10) Tattoo-friendly output mode

Provide an optional compact output mode intended for a wristband / arm tattoo.

Possible formats:

## Mode A: Every mile
| Mile | Elapsed |
|---:|---:|

## Mode B: Every 2 miles + checkpoints
| Marker | Elapsed |
|---|---:|

## Mode C: Checkpoints + major climbs
| Marker | Distance | Elapsed | Note |
|---|---:|---:|---|

Allow:
- compact font
- abbreviated labels
- export to CSV / Markdown

---

# 11) Validation tests

Implement end-to-end tests.

## 11.1 Course parsing tests
- GPX parses successfully
- TCX parses successfully
- cumulative distance is monotone
- elevation exists or warning is raised

## 11.2 Planning tests
- whole-course solve hits finish time within tolerance
- section-based solve hits section targets within tolerance
- dwell times shift downstream ETAs correctly

## 11.3 Output tests
- mile table has correct final elapsed
- checkpoint ETAs are monotone
- climb table uses the same pacing outputs as segment data

## 11.4 Model switching tests
- changing model changes outputs
- unavailable models stay disabled
- missing required calibration data blocks solve

---

# 12) Recommended defaults

- default hill model: `Strava GAP (user-inferred interpolation)`
- default planning mode:
  - whole-course if no checkpoints
  - checkpoint-section if checkpoints with cutoffs exist
- default granularity: `0.1 mile`
- default smoothing: `light`
- default units: remember last user choice

---

# 13) Suggested project structure

```text
/src
  /course
    parseGpx.ts
    parseTcx.ts
    resampleCourse.ts
    smoothElevation.ts
    detectClimbs.ts

  /models
    minetti.ts
    stravaInferred.ts
    acsm.ts
    htk.ts
    re3.ts
    runningWritings.ts
    hillrunner.ts
    ecor.ts
    personalStrydLike.ts
    registry.ts

  /planner
    solveWholeCourse.ts
    solveSections.ts
    aggregateMiles.ts
    aggregateCheckpoints.ts
    aggregateClimbs.ts

  /utils
    units.ts
    rootSolve.ts
    interpolation.ts
    paceFormatting.ts

  /types
    course.ts
    planner.ts
    models.ts
```

---

# 14) Deliverables Claude Code should build

1. model registry using `HILL_MODELS_SPEC.md`
2. course parser for GPX and TCX
3. whole-course solver
4. checkpoint-section solver
5. mile/km aggregation
6. checkpoint ETA table
7. climb detection + climb summary table
8. chart-ready data structures
9. export functions for CSV / JSON
10. test coverage for both solver paths

---

# 15) Definition of done

The calculator is done when it can:

- accept a GPX or TCX
- accept a target finish time
- allow model selection
- produce a whole-course or section-based pace plan
- export a mile-by-mile pace table
- export checkpoint ETAs
- show major climb summaries
- clearly warn the user when a selected model is inferred, reconstructed, or unavailable

---

# Nice-to-have future features

- "Target effort" mode. Accept a flat pace as input rather than target time. Convert that flat pace into the equivalent pace for each gradient to extrapolate the performance over each segment and overall.
- Allow the user to choose a slowdown scenario to apply. Enable it in both the target time mode and target effort mode. See `SLOWDOWN_SCENARIOS_CLAUDE_CODE_PROMPT.md` for details.
