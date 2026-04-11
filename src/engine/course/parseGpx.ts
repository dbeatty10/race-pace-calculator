import type { RawTrackPoint } from "@engine/types";

export function parseGpx(gpxString: string): RawTrackPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxString, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error(`Invalid GPX XML: ${parseError.textContent}`);
  }

  const trkpts = doc.querySelectorAll("trkpt");
  if (trkpts.length === 0) {
    throw new Error("No track points found in GPX");
  }

  const points: RawTrackPoint[] = [];

  trkpts.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute("lat") ?? "");
    const lon = parseFloat(trkpt.getAttribute("lon") ?? "");
    const eleEl = trkpt.querySelector("ele");

    if (!eleEl || eleEl.textContent === null) {
      throw new Error("Track point missing elevation data");
    }

    const ele = parseFloat(eleEl.textContent);

    if (isNaN(lat) || isNaN(lon) || isNaN(ele)) {
      throw new Error("Track point has invalid numeric data");
    }

    points.push({ lat, lon, ele });
  });

  return points;
}
