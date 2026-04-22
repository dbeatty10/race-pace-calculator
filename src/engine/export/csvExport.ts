import type { RacePlan } from "@engine/types";
import { formatPace, formatElapsedTime } from "@engine/utils/paceFormatting";

export function racePlanToCsv(plan: RacePlan): string {
  const header = "Split,Pace (/mi),Elapsed Time";
  const rows = plan.mileSplits.map(
    (s) =>
      `${s.label},${formatPace(s.paceSecPerMile)},${formatElapsedTime(s.elapsedSec)}`
  );
  return [header, ...rows].join("\n");
}

export function racePlanToJson(plan: RacePlan): string {
  return JSON.stringify(
    {
      summary: plan.summary,
      mileSplits: plan.mileSplits,
      climbs: plan.climbs,
      warnings: plan.warnings,
    },
    null,
    2
  );
}
