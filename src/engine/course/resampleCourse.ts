import type { RawTrackPoint, CoursePoint, Microsegment } from "@engine/types";
import { haversineMeters } from "./haversine";

export function rawPointsToCoursePoints(raw: RawTrackPoint[]): CoursePoint[] {
  const first = raw[0];
  if (!first) return [];

  const result: CoursePoint[] = [{ distance: 0, elevation: first.ele }];

  let cumDist = 0;
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1]!;
    const curr = raw[i]!;
    const d = haversineMeters(prev.lat, prev.lon, curr.lat, curr.lon);
    cumDist += d;
    result.push({ distance: cumDist, elevation: curr.ele });
  }

  return result;
}

function interpElevation(course: CoursePoint[], dist: number): number {
  if (course.length === 0) return 0;
  const first = course[0]!;
  const last = course[course.length - 1]!;

  if (dist <= first.distance) return first.elevation;
  if (dist >= last.distance) return last.elevation;

  for (let i = 1; i < course.length; i++) {
    const curr = course[i]!;
    if (dist <= curr.distance) {
      const prev = course[i - 1]!;
      const t = (dist - prev.distance) / (curr.distance - prev.distance);
      return prev.elevation + t * (curr.elevation - prev.elevation);
    }
  }

  return last.elevation;
}

export function resampleToMicrosegments(
  course: CoursePoint[],
  segmentDistance: number
): Microsegment[] {
  if (course.length === 0) return [];
  const last = course[course.length - 1]!;
  const totalDist = last.distance;
  const segments: Microsegment[] = [];

  let startDist = 0;
  while (startDist < totalDist - 0.01) {
    const endDist = Math.min(startDist + segmentDistance, totalDist);
    const dist = endDist - startDist;
    const startEle = interpElevation(course, startDist);
    const endEle = interpElevation(course, endDist);
    const elevChange = endEle - startEle;
    const gradePct = dist > 0 ? (elevChange / dist) * 100 : 0;

    segments.push({
      startDistance: startDist,
      endDistance: endDist,
      distance: dist,
      startElevation: startEle,
      endElevation: endEle,
      avgGradePct: gradePct,
    });

    startDist = endDist;
  }

  return segments;
}
