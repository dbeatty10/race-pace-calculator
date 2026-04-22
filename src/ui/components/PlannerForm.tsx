import type { PlanningMode, SmoothingLevel, SplitIntervalMode } from "@engine/types";
import { listModels } from "@engine/models/registry";
import { PERSONAL_CALIBRATION_ID } from "@engine/models/personalCalibration";
import { InfoTooltip } from "./InfoTooltip";

const PLANNING_MODE_TOOLTIP = (
  <>
    <p>
      <strong>Target finish time:</strong> You set a goal time (e.g. 3:45:00).
      The calculator solves for the flat-equivalent pace that — after applying
      the hill model to every segment — sums to exactly that finish time.
    </p>
    <p>
      <strong>Target effort (flat pace):</strong> You set a flat-equivalent pace
      (e.g. 12:30/mi) that represents your intended effort level. The hill model
      is applied directly to each segment without targeting a total time —
      uphills slow you down, downhills speed you up. Use this when you want to
      pace by feel rather than clock.
    </p>
  </>
);

const HILL_MODEL_TOOLTIP = (
  <>
    <p>
      <strong>Strava (default):</strong> Reverse-engineered from Strava's
      Grade-Adjusted Pace, derived from millions of real runner GPS + heart-rate
      records (Robb 2017). Conservative on descents.
    </p>
    <p>
      <strong>Minetti:</strong> From lab treadmill measurements of 8 subjects at
      grades −45% to +45% (Minetti et al. 2002). Computes the speed of equal
      metabolic cost to flat running. Strong evidence base, but calibrated on
      short efforts.
    </p>
    <p>
      <strong>RE3:</strong> Running Energy Expenditure Estimation (UMass). More
      recent than Minetti. More aggressive downhill benefit.
    </p>
    <p>
      <strong>ultraPacer:</strong> Piecewise model from ultrapacer.com. Quadratic
      from −22% to +16% grade, linear outside. Predicts larger penalties for
      very steep uphills.
    </p>
    <p>
      <strong>The Pacing Project:</strong> Speed-dependent cubic model
      reconstructed from The Pacing Project&apos;s published calculator outputs.
      The hill penalty varies with both grade and your flat running speed —
      faster runners lose proportionally more time on uphills. Grade range ±26%.
      Not official; see model warning for details.
    </p>
    <p>
      <strong>Personal calibration:</strong> Enter your own [grade%, multiplier]
      pairs from your race data. Requires at least 2 points. Example: &quot;8, 1.4&quot;
      means at 8% grade you run 1.4× slower than flat.
    </p>
  </>
);

const SMOOTHING_TOOLTIP = (
  <>
    <p>
      <strong>None:</strong> Raw GPS elevation exactly as recorded. May contain
      noise from GPS accuracy limits.
    </p>
    <p>
      <strong>Light:</strong> Mild filter. Removes small GPS artifacts while
      preserving most real elevation features. Good for clean GPS data.
    </p>
    <p>
      <strong>Medium:</strong> Moderate filter. Removes most GPS noise and small
      terrain bumps. Best for most race courses.
    </p>
    <p>
      <strong>Heavy:</strong> Aggressive filter. Best for very noisy data
      (canyons, dense forest, low-quality devices).
    </p>
  </>
);

const OFFICIAL_DISTANCE_TOOLTIP = (
  <>
    <p>
      If the official certified course distance differs from the GPX-measured
      distance, enter it here. Split labels and pace values will be shown on
      the official scale (e.g., a "13.1 mi" split at the physical mile-13 marker).
    </p>
    <p>
      Leave blank to use the GPX distance as-is. Typical use case: a GPX
      records 26.36 mi for a marathon; you enter "26.22 miles" so splits line
      up with on-course mile markers.
    </p>
  </>
);

const SPLIT_INTERVAL_TOOLTIP = (
  <>
    <p>
      <strong>Each mile:</strong> One split row per mile. Works for any
      distance.
    </p>
    <p>
      <strong>Each 5K (marathon checkpoints):</strong> Classic marathon
      landmarks — 5K, 10K, 15K, 20K, Half, 25K, 30K, and mile markers 20
      through 26.2. Only meaningful for marathon-distance courses (±0.5 mi).
      Falls back to every-5K boundaries on other distances.
    </p>
    <p>
      <strong>Custom (miles) / Custom (km):</strong> Enter comma-separated
      decimal distances without units, e.g. "13.1, 20, 26.2" for miles or
      "21.1, 30, 42.2" for km. Distances are sorted automatically.
    </p>
  </>
);

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
  splitMode: SplitIntervalMode;
  onSplitModeChange: (value: SplitIntervalMode) => void;
  customSplitText: string;
  onCustomSplitTextChange: (value: string) => void;
  officialDistanceValue: string;
  onOfficialDistanceValueChange: (value: string) => void;
  officialDistanceUnit: "miles" | "kilometers";
  onOfficialDistanceUnitChange: (value: "miles" | "kilometers") => void;
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
  splitMode,
  onSplitModeChange,
  customSplitText,
  onCustomSplitTextChange,
  officialDistanceValue,
  onOfficialDistanceValueChange,
  officialDistanceUnit,
  onOfficialDistanceUnitChange,
  canRun,
  onRun,
}: PlannerFormProps) {
  const models = listModels();

  return (
    <div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="planning-mode">
            Planning mode
            <InfoTooltip content={PLANNING_MODE_TOOLTIP} />
          </label>
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
          <label htmlFor="model-select">
            Hill model
            <InfoTooltip content={HILL_MODEL_TOOLTIP} />
          </label>
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
            {/* Personal calibration is a factory model, not registered in
                ALL_MODELS, so the pipeline receives it via customModel. */}
            <option value={PERSONAL_CALIBRATION_ID}>
              Personal calibration
            </option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="smoothing-select">
            Elevation smoothing
            <InfoTooltip content={SMOOTHING_TOOLTIP} />
          </label>
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

        <div className="form-group">
          <label htmlFor="split-mode">
            Split intervals
            <InfoTooltip content={SPLIT_INTERVAL_TOOLTIP} />
          </label>
          <select
            id="split-mode"
            value={splitMode}
            onChange={(e) =>
              onSplitModeChange(e.target.value as SplitIntervalMode)
            }
          >
            <option value="mile">Each mile</option>
            <option value="5k">Each 5K (marathon checkpoints)</option>
            <option value="custom_miles">Custom (miles)</option>
            <option value="custom_km">Custom (kilometers)</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="official-distance">
            Official course distance
            <InfoTooltip content={OFFICIAL_DISTANCE_TOOLTIP} />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="official-distance"
              type="text"
              inputMode="decimal"
              placeholder="(optional)"
              value={officialDistanceValue}
              onChange={(e) => onOfficialDistanceValueChange(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              id="official-distance-unit"
              value={officialDistanceUnit}
              onChange={(e) =>
                onOfficialDistanceUnitChange(
                  e.target.value as "miles" | "kilometers"
                )
              }
            >
              <option value="miles">miles</option>
              <option value="kilometers">kilometers</option>
            </select>
          </div>
        </div>
      </div>

      {(splitMode === "custom_miles" || splitMode === "custom_km") && (
        <div className="form-group" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="custom-splits">
            {splitMode === "custom_miles"
              ? "Custom distances (miles, comma-separated, e.g. 13.1, 20, 26.2)"
              : "Custom distances (km, comma-separated, e.g. 21.1, 30, 42.2)"}
          </label>
          <input
            id="custom-splits"
            type="text"
            placeholder={
              splitMode === "custom_miles" ? "13.1, 20, 26.2" : "21.1, 30, 42.2"
            }
            value={customSplitText}
            onChange={(e) => onCustomSplitTextChange(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      )}

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
