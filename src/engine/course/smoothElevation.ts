import type { CoursePoint, SmoothingLevel } from "@engine/types";

const WINDOW_SIZES: Record<SmoothingLevel, number> = {
  none: 1,
  light: 3,
  medium: 7,
  heavy: 15,
};

export function smoothElevation(
  course: CoursePoint[],
  level: SmoothingLevel
): CoursePoint[] {
  const window = WINDOW_SIZES[level];

  if (window <= 1 || course.length <= 2) {
    return course.map((p) => ({ ...p }));
  }

  const half = Math.floor(window / 2);
  const n = course.length;

  return course.map((point, i) => {
    // Preserve first and last points
    if (i === 0 || i === n - 1) {
      return { ...point };
    }

    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      sum += course[j]!.elevation;
      count++;
    }

    return { distance: point.distance, elevation: sum / count };
  });
}
