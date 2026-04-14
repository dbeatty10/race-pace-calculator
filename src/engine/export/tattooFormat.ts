import type { MileSplit } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

export function racePlanToTattoo(splits: MileSplit[]): string {
  // Determine max mile number width for alignment
  const maxMile = splits.length > 0 ? splits[splits.length - 1]!.mile : 0;
  const mileWidth = String(maxMile).length;

  return splits
    .map((s) => {
      const mileStr = String(s.mile).padStart(mileWidth);
      const pace = formatPace(s.paceSecPerMile);
      const elapsed = formatElapsedTime(s.elapsedSec);
      return `${mileStr}  ${pace}  ${elapsed}`;
    })
    .join("\n");
}
