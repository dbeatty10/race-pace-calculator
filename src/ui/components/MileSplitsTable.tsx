import type { MileSplit } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

interface MileSplitsTableProps {
  splits: MileSplit[];
}

export function MileSplitsTable({ splits }: MileSplitsTableProps) {
  return (
    <div>
      <h2>Mile Splits</h2>
      <table>
        <thead>
          <tr>
            <th>Mile</th>
            <th>Target Pace</th>
            <th>Elapsed Time</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr key={split.mile}>
              <td>{split.mile}</td>
              <td>{formatPace(split.paceSecPerMile)} /mi</td>
              <td>{formatElapsedTime(split.elapsedSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
