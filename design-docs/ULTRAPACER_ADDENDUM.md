# ULTRAPACER_ADDENDUM.md

## Purpose

This addendum adds the **ultrapacer default grade model** to the supported hill-model list.

The source of truth is the public ultrapacer core repository defaults file. The model is a **piecewise grade-to-factor function in grade percent**, with a quadratic middle section and linear behavior below and above fixed bounds.

---

## Category

### Empirical flat-equivalent models

### Implementation kind
`direct_multiplier`

This model belongs in the **direct multiplier** family because it maps grade directly to a pacing factor and does not require a speed-dependent inner solve.

---

## Source coefficients

The source file defines:

- middle quadratic coefficients:
  - `a = 0.0021`
  - `b = 0.034`
- lower linear bound:
  - `lim = -22`
  - `m = -0.0584`
  - `b = -0.0164`
- upper linear bound:
  - `lim = 16`
  - `m = 0.1012`
  - `b = 0.4624`

The source comments say the middle section is:

```text
f = a*x^2 + b*x
```

and that the function “goes linear at lower and upper bounds.”

---

## Formula

Let `g` be grade in **percent**.

Define the additive factor:

```text
f(g) =
  -0.0584*g - 0.0164                 if g < -22
   0.0021*g^2 + 0.034*g             if -22 <= g <= 16
   0.1012*g - 0.4624                if g > 16
```

Then define the pacing multiplier:

```text
M(g) = 1 + f(g)
```

So the pacing interpretation is:

```text
hill pace = flat-equivalent pace × M(g)
```

This makes ultrapacer a direct multiplier model suitable for the closed-form weighted-distance solve.

---

## Whole-course solve rule

For segment `i`:

```text
t_i = d_i * flatEqPace * M(g_i)
```

Whole-course solve:

```text
flatEqPace = targetTime / sum(d_i * M(g_i))
```

No root solver is required for this model.

---

## TypeScript implementation

```ts
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
```

---

## Notes

- This is a pragmatic pacing heuristic, not a mechanistic metabolic model.
- It is very simple to implement.
- It becomes quite aggressive on steep grades.
- It should be clearly labeled as an **ultrapacer default grade model** and not as a lab-derived metabolic-cost equation.

---

## Suggested UI label

- `ultrapacer default grade model`

Optional subtitle:
- `piecewise quadratic/linear grade heuristic`

---

## Suggested model registry entry

```ts
{
  id: "ultrapacer_default",
  label: "ultrapacer default grade model",
  category: "empirical_flat_equivalent",
  kind: "direct_multiplier",
  provenance: "source-code",
  gradePctMin: -100,
  gradePctMax: 100,
  supportsDownhill: true,
  notes: "Piecewise quadratic/linear grade-to-multiplier heuristic from ultrapacer core defaults.ts"
}
```
