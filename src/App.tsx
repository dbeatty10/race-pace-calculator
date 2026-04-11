import { useState, useCallback } from "react";
import type { RacePlan, SmoothingLevel } from "@engine/types";
import { parseTargetTime } from "@engine/utils/paceFormatting";
import { generateRacePlan } from "@engine/planner/pipeline";
import { CourseUpload } from "@ui/components/CourseUpload";
import { PlannerForm } from "@ui/components/PlannerForm";
import { SummaryPanel } from "@ui/components/SummaryPanel";
import { MileSplitsTable } from "@ui/components/MileSplitsTable";
import "./App.css";

export default function App() {
  const [gpxData, setGpxData] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [targetTime, setTargetTime] = useState("14:00");
  const [modelId, setModelId] = useState("strava_inferred");
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
      const targetSec = parseTargetTime(targetTime);
      const result = generateRacePlan({
        gpxData,
        targetFinishTimeSec: targetSec,
        modelId,
        smoothing,
      });
      setPlan(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlan(null);
    }
  }, [gpxData, targetTime, modelId, smoothing]);

  const canRun = gpxData !== null && targetTime.trim() !== "";

  return (
    <div className="app">
      <h1>Race Plan Calculator</h1>

      <CourseUpload onFileLoaded={handleFileLoaded} />
      {fileName && <p>Loaded: {fileName}</p>}

      <PlannerForm
        targetTime={targetTime}
        onTargetTimeChange={setTargetTime}
        modelId={modelId}
        onModelIdChange={setModelId}
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
