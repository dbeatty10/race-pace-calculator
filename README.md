# Race Pace Calculator

A web-based tool for planning your race paces accounting for hills. Designed for marathons, ultramarathons, and trail running.

## 🌐 Access the Calculator

**[Open the Race Pace Calculator](https://dbeatty10.github.io/race-pace-calculator/)**

## Features

### Core Planning

- **Target Time Mode** — Input your goal finish time, the calculator computes segment paces
- **Target Effort Mode** — Specify a flat-equivalent pace, the calculator adjusts for hills automatically
- **Hill Model Selection** — Choose from multiple models for the effect of hills:
  - **Strava** (default) — Based on real runner data, inferred from [Robb 2017](https://medium.com/strava-engineering/an-improved-gap-model-8b07ae8886c3)
  - **Minetti** — [OG physiological model](https://pubmed.ncbi.nlm.nih.gov/12183501/) of equal energy cost
  - **RE3** — [Running Energy Expenditure Estimation (RE3) model](https://sites.google.com/umass.edu/umill/calculator) of equal energy cost
  - **ultraPacer** — From the [ultraPacer.com](https://ultrapacer.com/) website
  - **Personal Calibration** — Specify [your own adjustment](https://pickletech.eu/blog-gap/) for uphills and downhills

### Course Analysis

- **GPX Upload** — Import your race course as a GPS file
- **Elevation Smoothing** — Filter out noise from elevation data (None, Light, Medium, Heavy)
- **Climb/Descent Detection** — Automatically identifies significant climbs and descents with elevations and grades
- **Course Summary** — Total climb, descent, weighted distance, and flat-equivalent pace

### Race Strategy

- **Slowdown Scenarios** — Forecast how "hitting the wall" would affect your splits:
  - Controlled / Tiny Late Fade
  - Gentle Late Fade
  - Moderate Late Fade
  - Wall-Lite
  - Classic Wall
  - Early Blow-Up
  - Custom (set your own onset, ramp, and plateau)

- **Two Slowdown Modes**:
  - **Forecast** — See adjusted splits if you fade
  - **Compensate to Target** — Automatically adjusts your baseline plan to still achieve your goal time taking the slowdown into account

### Export & Results

- **Mile-by-Mile Splits** — See pace and cumulative time for every mile
- **Baseline vs Adjusted Splits** — Compare planned splits vs. selected slowdown scenario
- **CSV Export** — Download splits for spreadsheets
- **JSON Export** — Export full plan data (summary, splits, climbs)
- **Wristband Format** — Compact fixed-width output for printing/copying to a race day card

## How to Use

1. **Upload a GPX file** of your race course
2. **Set your planning parameters:**
   - Choose "Target Time" or "Target Effort" mode
   - Input your goal finish time or flat-equivalent pace
   - Select a hill model
   - (Optional) Tune elevation smoothing
3. **Generate your plan** to see mile-by-mile splits
4. **Explore variations:**
   - Scroll to the "Climbs & Descents" table to see major elevation features
   - Select a slowdown scenario to forecast different pacing strategies
5. **Export your results** as CSV, JSON, or wristband format

---

**Built for runners, by runners.** Happy pacing! 🏃
