import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";
import { SLOWDOWN_PRESET_LABELS } from "@engine/slowdown/types";

interface SlowdownControlsProps {
  preset: SlowdownPreset;
  onPresetChange: (preset: SlowdownPreset) => void;
  mode: SlowdownMode;
  onModeChange: (mode: SlowdownMode) => void;
  customOnsetKm: string;
  onCustomOnsetKmChange: (value: string) => void;
  customRampKm: string;
  onCustomRampKmChange: (value: string) => void;
  customPlateauPct: string;
  onCustomPlateauPctChange: (value: string) => void;
}

const presetKeys: SlowdownPreset[] = [
  "none",
  "controlled_late_fade",
  "gentle_late_fade",
  "moderate_late_fade",
  "wall_lite",
  "classic_wall",
  "early_blowup",
  "custom",
];

export function SlowdownControls({
  preset,
  onPresetChange,
  mode,
  onModeChange,
  customOnsetKm,
  onCustomOnsetKmChange,
  customRampKm,
  onCustomRampKmChange,
  customPlateauPct,
  onCustomPlateauPctChange,
}: SlowdownControlsProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>Slowdown Scenario</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="slowdown-preset">Scenario</label>
          <select
            id="slowdown-preset"
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as SlowdownPreset)}
          >
            {presetKeys.map((k) => (
              <option key={k} value={k}>
                {SLOWDOWN_PRESET_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {preset !== "none" && (
          <div className="form-group">
            <label htmlFor="slowdown-mode">Mode</label>
            <select
              id="slowdown-mode"
              value={mode}
              onChange={(e) => onModeChange(e.target.value as SlowdownMode)}
            >
              <option value="forecast">Forecast</option>
              <option value="compensate_to_target">Compensate to target</option>
            </select>
          </div>
        )}
      </div>

      {preset === "custom" && (
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="custom-onset">Onset (km)</label>
            <input
              id="custom-onset"
              type="text"
              value={customOnsetKm}
              onChange={(e) => onCustomOnsetKmChange(e.target.value)}
              placeholder="30"
              style={{ width: "80px" }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="custom-ramp">Ramp (km)</label>
            <input
              id="custom-ramp"
              type="text"
              value={customRampKm}
              onChange={(e) => onCustomRampKmChange(e.target.value)}
              placeholder="3"
              style={{ width: "80px" }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="custom-plateau">Plateau (%)</label>
            <input
              id="custom-plateau"
              type="text"
              value={customPlateauPct}
              onChange={(e) => onCustomPlateauPctChange(e.target.value)}
              placeholder="10"
              style={{ width: "80px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
