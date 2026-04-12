import type { ClimbSegment } from "@engine/types";
import { metersToMiles, metersToFeet } from "@engine/utils/units";

interface ClimbTableProps {
  climbs: ClimbSegment[];
}

export function ClimbTable({ climbs }: ClimbTableProps) {
  if (climbs.length === 0) return null;

  return (
    <div>
      <h2>Climbs &amp; Descents</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Start (mi)</th>
            <th>End (mi)</th>
            <th>Distance (mi)</th>
            <th>Elev Change (ft)</th>
            <th>Avg Grade</th>
          </tr>
        </thead>
        <tbody>
          {climbs.map((c, i) => (
            <tr key={i}>
              <td>{c.type === "climb" ? "Climb" : "Descent"}</td>
              <td>{metersToMiles(c.startDistance).toFixed(1)}</td>
              <td>{metersToMiles(c.endDistance).toFixed(1)}</td>
              <td>{metersToMiles(c.distance).toFixed(2)}</td>
              <td>{metersToFeet(c.elevationChange).toFixed(0)}</td>
              <td>{c.avgGradePct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
