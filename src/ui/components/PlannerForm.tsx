import type { PlanningMode, SmoothingLevel } from "@engine/types";
import { listModels } from "@engine/models/registry";
import { PERSONAL_CALIBRATION_ID } from "@engine/models/personalCalibration";

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
          <label htmlFor="planning-mode">Planning mode</label>
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
            {/* Personal calibration is a factory model, not registered in
                ALL_MODELS, so the pipeline receives it via customModel. */}
            <option value={PERSONAL_CALIBRATION_ID}>
              Personal calibration
            </option>
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
