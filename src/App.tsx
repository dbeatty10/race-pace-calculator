import { useState, useCallback } from "react";
import type { RacePlan, PlanningMode, SmoothingLevel } from "@engine/types";
import { parseTargetTime } from "@engine/utils/paceFormatting";
import { generateRacePlan } from "@engine/planner/pipeline";
import {
  createPersonalCalibrationModel,
  parseCalibrationText,
  PERSONAL_CALIBRATION_ID,
} from "@engine/models/personalCalibration";
import { CourseUpload } from "@ui/components/CourseUpload";
import { PlannerForm } from "@ui/components/PlannerForm";
import { SummaryPanel } from "@ui/components/SummaryPanel";
import { MileSplitsTable } from "@ui/components/MileSplitsTable";
import "./App.css";

function parseFlatPaceToSecPerMile(input: string): number {
  const trimmed = input.trim();
  const parts = trimmed.split(":");
  if (parts.length === 2) {
    const min = parseInt(parts[0]!, 10);
    const sec = parseInt(parts[1]!, 10);
    if (isNaN(min) || isNaN(sec)) throw new Error(`Invalid pace: ${input}`);
    return min * 60 + sec;
  }
  const val = parseFloat(trimmed);
  if (isNaN(val)) throw new Error(`Invalid pace: ${input}`);
  return val * 60;
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
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileLoaded = useCallback((data: string, name: string) => {
    setGpxData(data);
    setFileName(name);
    setPlan(null);
    setError(null);
  }, []);

  const handleRun = useCallback(() => {
    if (!gpxData) return;

    try {
      let customModel;
      if (modelId === PERSONAL_CALIBRATION_ID) {
        const points = parseCalibrationText(calibrationText);
        customModel = createPersonalCalibrationModel(points);
      }

      const result = generateRacePlan({
        gpxData,
        modelId,
        customModel,
        smoothing,
        planningMode,
        targetFinishTimeSec:
          planningMode === "target_time"
            ? parseTargetTime(targetTime)
            : undefined,
        flatEquivalentPaceSecPerMile:
          planningMode === "target_effort"
            ? parseFlatPaceToSecPerMile(flatEquivalentPace)
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
  ]);

  const canRun = gpxData !== null;

  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>

      <CourseUpload onFileLoaded={handleFileLoaded} />
      {fileName && <p>Loaded: {fileName}</p>}

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
        canRun={canRun}
        onRun={handleRun}
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
        </>
      )}
    </div>
  );
}
