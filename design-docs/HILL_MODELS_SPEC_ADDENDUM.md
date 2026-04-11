# HILL_MODELS_SPEC_ADDENDUM.md

---

# ADDENDUM: Model taxonomy and solve strategy

This addendum clarifies that there are **four implementation categories**, not just two.

The earlier spec already describes:

1. whole-course solve for direct multiplier models
2. whole-course solve for demand models

Those are both valid, but they do **not** cover every model discussed.

The full implementation taxonomy should be:

- direct multiplier models
- demand models
- interpolation / table models
- proprietary / unavailable models

---

## Why this addendum exists

Some hill models directly return a grade-based pacing multiplier.

Some instead return a demand / cost / metabolic equation that requires solving for hill speed.

Some are defined primarily by a table or interpolation surface rather than a compact formula.

Some are proprietary or individualized enough that they cannot be implemented exactly from public information.

So the calculator architecture should explicitly support all four categories.

---

## A) Direct multiplier models

### Definition

A model belongs in this category if it can directly provide:

```text
M = f(gradePct)
```

where `M` is a pacing multiplier such that:

```text
hill pace = flat-equivalent pace × M
```

Flat should usually satisfy:

```text
M(0) = 1
```

### Characteristics

A model is a good fit for this category if:

- it depends only on grade
- it returns a normalized multiplier directly
- it can be applied segment-by-segment without solving for speed
- whole-course pacing can be solved with a closed-form weighted-distance equation
- no root solver is needed for the inner segment calculation

### Whole-course solve rule

For segment `i`:

```text
t_i = d_i * flatEqPace * M(g_i)
```

Whole-course solve:

```text
flatEqPace = targetTime / sum(d_i * M(g_i))
```

### Models that belong here

These should be treated as direct multiplier models in the codebase:

- Minetti
- Strava GAP (user-inferred interpolation curve)
- van Dijk & van Megen ECOR hill formula
- Updated HTK, if implemented via its simplified normalized multiplier form
- personal Stryd-like uphill curve, if used in “simple multiplier mode”
- HillRunner renormalized surrogate, if the user chooses a fixed reference pace

### Important note about Minetti

Minetti is scientifically a metabolic-cost model, but computationally it behaves like a direct multiplier when normalized as:

```text
M(g) = Cr(g) / Cr(0)
```

So for implementation, Minetti should be classified as a direct multiplier model.

### Important note about Updated HTK

Updated HTK can be expressed as a demand model, but because the speed term is linear, it can also be simplified into a direct normalized multiplier for pacing purposes.

So Updated HTK may be implemented as either:

- a demand model
- or a direct multiplier model

For simplicity, direct multiplier implementation is acceptable.

---

## B) Demand models

### Definition

A model belongs in this category if it defines a demand / cost / metabolic equation of the form:

```text
D(speed, grade)
```

and hill pacing must be obtained by solving:

```text
D(v_hill, grade) = D(v_flat, 0)
```

### Characteristics

A model is a good fit for this category if:

- it includes speed explicitly
- it predicts metabolic rate, oxygen cost, power demand, or similar
- it does not directly yield one universal multiplier by grade alone
- hill speed must be solved numerically or algebraically
- whole-course pacing usually requires an outer solve on the flat-equivalent speed

### Whole-course solve rule

1. choose candidate flat-equivalent speed `v_flat`
2. for each segment, solve `v_hill` such that:

```text
D(v_hill, grade_i) = D(v_flat, 0)
```

3. compute segment time:

```text
t_i = d_i / v_hill
```

4. outer-solve `v_flat` until total time matches target finish time

### Models that belong here

These should be treated as demand models in the codebase:

- ACSM
- Updated RE3
- Running Writings
- personal Stryd-like uphill curve, if used with a user power-speed curve

### Important note about personal Stryd-like mode

The personal Stryd-like uphill curve can be implemented in two ways:

#### Simple multiplier mode
Treat it as:

```text
M(g) = 1 + 0.04305*g + 0.0008379*g^2
```

This is easier but less strict.

#### Power-curve mode
If the user provides `P_flat(v)`, solve:

```text
P_flat(v_hill) * M(g) = P_flat(v_flat)
```

This is more principled and should be classified as a demand model.

Both modes are acceptable if clearly labeled.

---

## C) Interpolation / table models

### Definition

A model belongs in this category if the primary source of truth is:

- a table
- a lookup grid
- a discrete set of measured / digitized points
- an interpolation surface

rather than one compact analytical formula

### Characteristics

A model is a good fit for this category if:

- the model is defined by tabular data
- interpolation is the primary computation
- it may depend on one variable (grade only) or more than one variable (pace and grade)
- the implementation should prioritize fidelity to the source table rather than forcing a formula

### Subtypes

#### C1. Grade-only interpolation models
These behave similarly to direct multiplier models after interpolation.

Examples:
- Strava GAP inferred points, if implemented strictly as interpolation without formula fallback

#### C2. Pace-dependent table models
These need table lookup or interpolation in more than one dimension.

Examples:
- HillRunner official table

### Whole-course solve rule

This depends on the table shape.

#### If grade-only
Treat like a direct multiplier model after interpolation.

#### If pace-dependent
Use interpolation first, then solve as needed.

Examples:
- HillRunner official table may require interpolation in pace + incline
- after interpolation, either compute equivalent flat pace directly or derive a multiplier for a chosen reference pace

### Models that belong here

These should be classified as interpolation / table models:

- HillRunner official table
- Strava GAP inferred point curve, if implemented as pure interpolation
- any future user-uploaded custom grade table
- any calibration table derived from personal testing

### Important note about HillRunner

HillRunner should primarily be implemented as a table / interpolation model.

Its surrogate fitted formula is optional and secondary.

---

## D) Proprietary / unavailable models

### Definition

A model belongs in this category if:

- the exact formula is not public
- the model is learned from private data
- the vendor describes it conceptually but not mathematically
- only approximations or placeholders are possible

### Characteristics

A model is a good fit for this category if:

- exact implementation cannot be justified from public sources
- any implementation would be approximate, inferred, or speculative
- the UI should show the model as unavailable or explanatory only

### UI behavior

For these models, the app should:

- list the model
- explain why it is unavailable
- optionally suggest a public approximation
- never imply exact implementation unless the user explicitly selects an inferred surrogate

### Models that belong here

These should be classified as proprietary / unavailable:

- Stryd official
- COROS Effort Pace
- PickleTech individualized GAP
- runbundle exact internal logic

---

## Final implementation taxonomy

The `ModelKind` union should be expanded to:

```ts
export type ModelKind =
  | "direct_multiplier"
  | "demand_model"
  | "interpolation_model"
  | "proprietary_unavailable";
```

---

## Recommended mapping of discussed models

| Model | Recommended kind | Notes |
|---|---|---|
| Minetti | `direct_multiplier` | Normalize `Cr(g)/Cr(0)` |
| Strava GAP (user-inferred) | `interpolation_model` or `direct_multiplier` | Interpolation-first; may expose as multiplier |
| ACSM | `demand_model` | Speed-dependent oxygen-cost model |
| Updated HTK | `direct_multiplier` or `demand_model` | Direct multiplier form acceptable |
| Updated RE3 | `demand_model` | Speed-dependent, solve numerically |
| Running Writings | `demand_model` | Black baseline + Minetti delta + inverse solve |
| HillRunner official | `interpolation_model` | Table-first implementation |
| HillRunner surrogate | `direct_multiplier` or pace-dependent helper | Secondary approximation only |
| van Dijk & van Megen ECOR hill formula | `direct_multiplier` | Simple normalized multiplier |
| Personal Stryd-like uphill (simple) | `direct_multiplier` | Fast approximation |
| Personal Stryd-like uphill (with power curve) | `demand_model` | Better if user power curve exists |
| Stryd official | `proprietary_unavailable` | Do not claim exact formula |
| COROS Effort Pace | `proprietary_unavailable` | Individualized / non-public |
| PickleTech individualized GAP | `proprietary_unavailable` | Conceptual unless fitted from user data |
| runbundle exact | `proprietary_unavailable` | Do not claim exact implementation |

---

## Practical rule for the planner

When the user selects a model:

### If kind = `direct_multiplier`
Use the closed-form weighted-distance solve.

### If kind = `demand_model`
Use the nested solve:
- inner solve for hill speed
- outer solve for flat-equivalent speed

### If kind = `interpolation_model`
Interpolate first, then:
- if the result is a grade-only multiplier, use the direct multiplier planner
- if the table is pace-dependent, solve using the pace-dependent lookup behavior

### If kind = `proprietary_unavailable`
Show explanatory UI only, plus optional approximation suggestions.

---

## Recommendation

The codebase should use these four categories explicitly.

This is more accurate than treating everything as only either:

- direct multiplier
- demand model

because it properly handles:

- HillRunner-style table models
- inferred Strava point sets
- proprietary models that cannot be implemented exactly
