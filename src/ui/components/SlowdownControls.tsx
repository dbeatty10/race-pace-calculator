import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";
import { SLOWDOWN_PRESET_LABELS } from "@engine/slowdown/types";
import { InfoTooltip } from "./InfoTooltip";

const SLOWDOWN_PRESET_TOOLTIP = (
  <>
    <p>
      <strong>No slowdown:</strong> Assumes you hold baseline pace to the finish
      — your ideal-case plan.
    </p>
    <p>
      <strong>Controlled / tiny late fade:</strong> Onset 37 km, 3 km ramp, +2%
      plateau. Best case — tiny drift in the final miles.
    </p>
    <p>
      <strong>Gentle late fade:</strong> Onset 32 km, 4 km ramp, +5%. Common
      for fit runners who go slightly too fast.
    </p>
    <p>
      <strong>Moderate late fade:</strong> Onset 31 km, 4 km ramp, +10%.
      Noticeable fatigue. Pace drops ~1 min/mi for a 10 min/mi runner.
    </p>
    <p>
      <strong>Wall-lite:</strong> Onset 31 km, 3 km ramp, +20%. Significant
      glycogen depletion. Pace drops ~2 min/mi.
    </p>
    <p>
      <strong>Classic wall:</strong> Onset 30 km, 3 km ramp, +30%. The iconic
      marathon wall. Pace drops ~3 min/mi.
    </p>
    <p>
      <strong>Early blow-up:</strong> Onset 27 km, 4 km ramp, +25%. Wall hits
      earlier, caused by going out too aggressively.
    </p>
    <p>
      <strong>Custom:</strong> You control all three parameters. Adjusted pace =
      baseline × (1 + plateau ÷ 100) at full slowdown.
    </p>
  </>
);

const SLOWDOWN_MODE_TOOLTIP = (
  <>
    <p>
      <strong>Forecast:</strong> Applies the slowdown on top of your existing
      baseline plan. Shows actual finish time and splits if you hit the wall
      exactly as described. Use this for "what if I blow up?" analysis.
    </p>
    <p>
      <strong>Compensate to target:</strong> Finds a faster internal baseline —
      using bisection search — such that the slowdown-adjusted finish still hits
      your target time. Example: if the wall adds 12 min, the plan targets 3:33
      on the baseline so the wall brings you back to 3:45. Not recommended: going
      faster early increases the likelihood of a worse wall.
    </p>
  </>
);

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
          <label htmlFor="slowdown-preset">
            Scenario
            <InfoTooltip content={SLOWDOWN_PRESET_TOOLTIP} />
          </label>
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
            <label htmlFor="slowdown-mode">
              Mode
              <InfoTooltip content={SLOWDOWN_MODE_TOOLTIP} />
            </label>
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
