import type { PlanSummary } from "@engine/types";
import {
  formatPace,
  formatElapsedTime,
} from "@engine/utils/paceFormatting";
import { metersToMiles, metersToFeet } from "@engine/utils/units";

interface SummaryPanelProps {
  summary: PlanSummary;
}

export function SummaryPanel({ summary }: SummaryPanelProps) {
  const isEffortMode = summary.planningMode === "target_effort";

  return (
    <div>
      <h2>Plan Summary</h2>
      <dl className="summary-grid">
        <dt>Hill model</dt>
        <dd>{summary.modelLabel}</dd>

        <dt>{isEffortMode ? "Projected finish time" : "Target finish time"}</dt>
        <dd>{formatElapsedTime(summary.targetFinishTimeSec)}</dd>

        {!isEffortMode && (
          <>
            <dt>Computed finish time</dt>
            <dd>{formatElapsedTime(summary.computedFinishTimeSec)}</dd>
          </>
        )}

        <dt>Course length</dt>
        <dd>{metersToMiles(summary.courseLengthMeters).toFixed(2)} mi</dd>

        {Math.abs(summary.courseLengthMeters - summary.gpxDistanceMeters) > 1 && (
          <>
            <dt>GPX measured</dt>
            <dd>{metersToMiles(summary.gpxDistanceMeters).toFixed(2)} mi</dd>
          </>
        )}

        <dt>Total climb</dt>
        <dd>{metersToFeet(summary.totalClimbMeters).toFixed(0)} ft</dd>

        <dt>Total descent</dt>
        <dd>{metersToFeet(summary.totalDescentMeters).toFixed(0)} ft</dd>

        <dt>
          {isEffortMode
            ? "Input flat-equivalent pace"
            : "Flat-equivalent pace"}
        </dt>
        <dd>{formatPace(summary.flatEquivalentPaceSecPerMile)} /mi</dd>
      </dl>
    </div>
  );
}
