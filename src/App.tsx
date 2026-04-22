import { useState, useCallback } from "react";
import type { RacePlan, PlanningMode, SmoothingLevel, SplitIntervalMode } from "@engine/types";
import { parseTargetTime, formatElapsedTime } from "@engine/utils/paceFormatting";
import { generateRacePlan } from "@engine/planner/pipeline";
import {
  createPersonalCalibrationModel,
  parseCalibrationText,
  PERSONAL_CALIBRATION_ID,
} from "@engine/models/personalCalibration";
import type { SlowdownPreset, SlowdownMode } from "@engine/slowdown/types";
import { METERS_PER_MILE } from "@engine/utils/units";
import { CourseUpload } from "@ui/components/CourseUpload";
import { InfoTooltip } from "@ui/components/InfoTooltip";
import { PlannerForm } from "@ui/components/PlannerForm";
import { SummaryPanel } from "@ui/components/SummaryPanel";
import { MileSplitsTable } from "@ui/components/MileSplitsTable";
import { ClimbTable } from "@ui/components/ClimbTable";
import { SlowdownControls } from "@ui/components/SlowdownControls";
import { SlowdownSplitsTable } from "@ui/components/SlowdownSplitsTable";
import { ExportControls } from "@ui/components/ExportControls";
import "./App.css";

function parseFlatPaceToSecPerMile(input: string): number {
  const trimmed = input.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const min = parseInt(parts[0]!, 10);
    const sec = parseInt(parts[1]!, 10);
    if (isNaN(min) || isNaN(sec)) throw new Error(`Invalid pace "${input}" — use mm:ss format, e.g. 12:30`);
    return min * 60 + sec;
  }
  throw new Error(`Invalid pace "${input}" — use mm:ss format, e.g. 12:30`);
}

function parseCustomSplits(text: string, unitFactor: number): number[] {
  return text
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
    .map((d) => d * unitFactor);
}

function parseOfficialDistance(
  value: string,
  unit: "miles" | "kilometers"
): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return unit === "miles" ? parsed * METERS_PER_MILE : parsed * 1000;
}

export default function App() {
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [planningMode, setPlanningMode] = useState<PlanningMode>("target_time");
  const [targetTime, setTargetTime] = useState("14:00");
  const [flatEquivalentPace, setFlatEquivalentPace] = useState("12:30");
  const [modelId, setModelId] = useState("strava_inferred");
  const [calibrationText, setCalibrationText] = useState("");
  const [smoothing, setSmoothing] = useState<SmoothingLevel>("light");
  const [splitMode, setSplitMode] = useState<SplitIntervalMode>("mile");
  const [customSplitText, setCustomSplitText] = useState("");
  const [officialDistanceValue, setOfficialDistanceValue] = useState("");
  const [officialDistanceUnit, setOfficialDistanceUnit] = useState<
    "miles" | "kilometers"
  >("miles");
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slowdownPreset, setSlowdownPreset] = useState<SlowdownPreset>("none");
  const [slowdownMode, setSlowdownMode] = useState<SlowdownMode>("forecast");
  const [customOnsetKm, setCustomOnsetKm] = useState("30");
  const [customRampKm, setCustomRampKm] = useState("3");
  const [customPlateauPct, setCustomPlateauPct] = useState("10");

  const handleFileLoaded = useCallback((data: string, name: string) => {
    setGpxData(data);
    setFileName(name);
    setPlan(null);
    setError(null);
    setOfficialDistanceValue("");
    setOfficialDistanceUnit("miles");
  }, []);

  const handleRun = useCallback(() => {
    if (!gpxData) return;

    try {
      let customModel;
      if (modelId === PERSONAL_CALIBRATION_ID) {
        const points = parseCalibrationText(calibrationText);
        customModel = createPersonalCalibrationModel(points);
      }

      const customSplitDistancesM =
        splitMode === "custom_miles"
          ? parseCustomSplits(customSplitText, METERS_PER_MILE)
          : splitMode === "custom_km"
          ? parseCustomSplits(customSplitText, 1000)
          : undefined;

      const officialDistanceM = parseOfficialDistance(
        officialDistanceValue,
        officialDistanceUnit
      );

      const result = generateRacePlan({
        gpxData,
        modelId,
        customModel,
        smoothing,
        planningMode,
        splitMode,
        customSplitDistancesM,
        officialDistanceM,
        targetFinishTimeSec:
          planningMode === "target_time"
            ? parseTargetTime(targetTime)
            : undefined,
        flatEquivalentPaceSecPerMile:
          planningMode === "target_effort"
            ? parseFlatPaceToSecPerMile(flatEquivalentPace)
            : undefined,
        slowdownPreset: slowdownPreset !== "none" ? slowdownPreset : undefined,
        slowdownMode,
        slowdownOnsetMeters:
          slowdownPreset === "custom"
            ? parseFloat(customOnsetKm) * 1000
            : undefined,
        slowdownRampMeters:
          slowdownPreset === "custom"
            ? parseFloat(customRampKm) * 1000
            : undefined,
        slowdownPlateauFraction:
          slowdownPreset === "custom"
            ? parseFloat(customPlateauPct) / 100
            : undefined,
      });
      setPlan(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlan(null);
    }
  }, [
    gpxData,
    planningMode,
    targetTime,
    flatEquivalentPace,
    modelId,
    calibrationText,
    smoothing,
    splitMode,
    customSplitText,
    officialDistanceValue,
    officialDistanceUnit,
    slowdownPreset,
    slowdownMode,
    customOnsetKm,
    customRampKm,
    customPlateauPct,
  ]);

  const canRun = gpxData !== null;

  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>

      <CourseUpload onFileLoaded={handleFileLoaded} />
      {fileName && <p>Loaded: {fileName}</p>}

      <div className="form-group" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="official-distance">
          Official course distance
          <InfoTooltip content={
            <>
              <p>
                If the official certified course distance differs from the
                GPX-measured distance, enter it here. Split labels and pace
                values will be shown on the official scale (e.g., a
                &quot;13.1 mi&quot; split at the physical mile-13 marker).
              </p>
              <p>
                Leave blank to use the GPX distance as-is. Typical use case:
                a GPX records 26.36 mi for a marathon; you enter
                &quot;26.22 miles&quot; so splits line up with on-course mile
                markers.
              </p>
            </>
          } />
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            id="official-distance"
            type="text"
            inputMode="decimal"
            placeholder="(optional)"
            value={officialDistanceValue}
            onChange={(e) => setOfficialDistanceValue(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            id="official-distance-unit"
            aria-label="Official distance unit"
            value={officialDistanceUnit}
            onChange={(e) =>
              setOfficialDistanceUnit(e.target.value as "miles" | "kilometers")
            }
          >
            <option value="miles">miles</option>
            <option value="kilometers">kilometers</option>
          </select>
        </div>
      </div>

      <PlannerForm
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        targetTime={targetTime}
        onTargetTimeChange={setTargetTime}
        flatEquivalentPace={flatEquivalentPace}
        onFlatEquivalentPaceChange={setFlatEquivalentPace}
        modelId={modelId}
        onModelIdChange={setModelId}
        calibrationText={calibrationText}
        onCalibrationTextChange={setCalibrationText}
        smoothing={smoothing}
        onSmoothingChange={setSmoothing}
        splitMode={splitMode}
        onSplitModeChange={setSplitMode}
        customSplitText={customSplitText}
        onCustomSplitTextChange={setCustomSplitText}
        canRun={canRun}
        onRun={handleRun}
      />

      <SlowdownControls
        preset={slowdownPreset}
        onPresetChange={setSlowdownPreset}
        mode={slowdownMode}
        onModeChange={setSlowdownMode}
        customOnsetKm={customOnsetKm}
        onCustomOnsetKmChange={setCustomOnsetKm}
        customRampKm={customRampKm}
        onCustomRampKmChange={setCustomRampKm}
        customPlateauPct={customPlateauPct}
        onCustomPlateauPctChange={setCustomPlateauPct}
      />

      {error && <div className="warning">{error}</div>}

      {plan && (
        <>
          {plan.warnings.map((w, i) => (
            <div key={i} className="warning">
              {w}
            </div>
          ))}
          <SummaryPanel summary={plan.summary} />
          <MileSplitsTable splits={plan.mileSplits} />
          <ClimbTable climbs={plan.climbs} />
          {plan.slowdown && (
            <>
              <div className="summary-grid" style={{ marginTop: "1rem" }}>
                <dt>Baseline finish</dt>
                <dd>{formatElapsedTime(plan.slowdown.baselineFinishTimeSec)}</dd>
                <dt>Adjusted finish</dt>
                <dd>{formatElapsedTime(plan.slowdown.adjustedFinishTimeSec)}</dd>
                <dt>Slowdown cost</dt>
                <dd>+{formatElapsedTime(plan.slowdown.slowdownCostSec)}</dd>
              </div>
              <SlowdownSplitsTable splits={plan.slowdown.adjustedMileSplits} />
            </>
          )}
          <ExportControls plan={plan} />
        </>
      )}
    </div>
  );
}
