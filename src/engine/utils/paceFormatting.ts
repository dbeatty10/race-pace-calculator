export function formatPace(secPerMile: number): string {
  const totalSec = Math.round(secPerMile);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatElapsedTime(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseTargetTime(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty target time");

  const parts = trimmed.split(":");

  if (parts.length === 3) {
    const h = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    const s = parseInt(parts[2]!, 10);
    if (isNaN(h) || isNaN(m) || isNaN(s)) throw new Error(`Invalid time: ${input}`);
    return h * 3600 + m * 60 + s;
  }

  if (parts.length === 2) {
    const h = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    if (isNaN(h) || isNaN(m)) throw new Error(`Invalid time: ${input}`);
    return h * 3600 + m * 60;
  }

  if (parts.length === 1) {
    const minutes = parseFloat(trimmed);
    if (isNaN(minutes)) throw new Error(`Invalid time: ${input}`);
    return minutes * 60;
  }

  throw new Error(`Invalid time format: ${input}`);
}
