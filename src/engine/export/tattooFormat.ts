import type { SplitResult } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

export function racePlanToTattoo(splits: SplitResult[]): string {
  const maxLabelLen = splits.reduce((m, s) => Math.max(m, s.label.length), 0);

  return splits
    .map((s) => {
      const labelStr = s.label.padStart(maxLabelLen);
      const pace = formatPace(s.paceSecPerMile);
      const elapsed = formatElapsedTime(s.elapsedSec);
      return `${labelStr}  ${pace}  ${elapsed}`;
    })
    .join("\n");
}
