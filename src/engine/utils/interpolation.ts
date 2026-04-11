export function interp1d(points: [number, number][], x: number): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);

  // Handle empty array
  if (sorted.length === 0) return 0;

  // Clamp below range
  if (x <= sorted[0]![0]) return sorted[0]![1];

  // Clamp above range
  if (x >= sorted[sorted.length - 1]![0]) return sorted[sorted.length - 1]![1];

  // Linear interpolation between points
  for (let i = 1; i < sorted.length; i++) {
    const [x1, y1] = sorted[i - 1]!;
    const [x2, y2] = sorted[i]!;
    if (x <= x2) {
      const t = (x - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }

  // Should never reach here if input is valid
  return sorted[sorted.length - 1]![1];
}
