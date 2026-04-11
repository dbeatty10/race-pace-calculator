import type { SmoothingLevel } from "@engine/types";
import { listModels } from "@engine/models/registry";

interface PlannerFormProps {
  targetTime: string;
  onTargetTimeChange: (value: string) => void;
  modelId: string;
  onModelIdChange: (value: string) => void;
  smoothing: SmoothingLevel;
  onSmoothingChange: (value: SmoothingLevel) => void;
  canRun: boolean;
  onRun: () => void;
}

export function PlannerForm({
  targetTime,
  onTargetTimeChange,
  modelId,
  onModelIdChange,
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
          <label htmlFor="target-time">Target finish time</label>
          <input
            id="target-time"
            type="text"
            placeholder="14:00 or 840 (minutes)"
            value={targetTime}
            onChange={(e) => onTargetTimeChange(e.target.value)}
          />
        </div>

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

      <button disabled={!canRun} onClick={onRun}>
        Generate Plan
      </button>
    </div>
  );
}
