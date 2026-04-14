import type { PlanningMode, SmoothingLevel } from "@engine/types";
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
      <strong>Personal calibration:</strong> Enter your own [grade%, multiplier]
      pairs from your race data. Requires at least 2 points. Example: "8, 1.4"
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
