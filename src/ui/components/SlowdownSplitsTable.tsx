import type { AdjustedSplitResult } from "@engine/slowdown/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

interface SlowdownSplitsTableProps {
  splits: AdjustedSplitResult[];
}

export function SlowdownSplitsTable({ splits }: SlowdownSplitsTableProps) {
  return (
    <div>
      <h2>Baseline vs Adjusted Splits</h2>
      <table>
        <thead>
          <tr>
            <th>Split</th>
            <th>Baseline Pace</th>
            <th>Adjusted Pace</th>
            <th>Baseline Elapsed</th>
            <th>Adjusted Elapsed</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={split.distanceM}>
              <td>{split.label}</td>
              <td>{formatPace(split.baselinePaceSecPerMile)} /mi</td>
              <td>{formatPace(split.adjustedPaceSecPerMile)} /mi</td>
              <td>{formatElapsedTime(split.baselineElapsedSec)}</td>
              <td>{formatElapsedTime(split.adjustedElapsedSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
