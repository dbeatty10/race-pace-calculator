import type { RacePlan } from "@engine/types";
import { racePlanToCsv, racePlanToJson } from "@engine/export/csvExport";
import { racePlanToTattoo } from "@engine/export/tattooFormat";
import { useState } from "react";

interface ExportControlsProps {
  plan: RacePlan;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportControls({ plan }: ExportControlsProps) {
  const [showTattoo, setShowTattoo] = useState(false);

  return (
    <div style={{ marginTop: "1rem" }}>
      <h2>Export</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => downloadBlob(racePlanToCsv(plan), "race-plan.csv", "text/csv")}
        >
          Download CSV
        </button>
        <button
          onClick={() =>
            downloadBlob(racePlanToJson(plan), "race-plan.json", "application/json")
          }
        >
          Download JSON
        </button>
        <button onClick={() => setShowTattoo((prev) => !prev)}>
          {showTattoo ? "Hide" : "Show"} Wristband Format
        </button>
      </div>

      {showTattoo && (
        <pre
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            overflowX: "auto",
          }}
        >
          {racePlanToTattoo(plan.mileSplits)}
        </pre>
      )}
    </div>
  );
}
