import type { SplitResult } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

interface MileSplitsTableProps {
  splits: SplitResult[];
}

export function MileSplitsTable({ splits }: MileSplitsTableProps) {
  return (
    <div>
      <h2>Splits</h2>
      <table>
        <thead>
          <tr>
            <th>Split</th>
            <th>Target Pace</th>
            <th>Elapsed Time</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={split.distanceM}>
              <td>{split.label}</td>
              <td>{formatPace(split.paceSecPerMile)} /mi</td>
              <td>{formatElapsedTime(split.elapsedSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
