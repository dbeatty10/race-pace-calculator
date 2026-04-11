import { describe, it, expect } from "vitest";
import { parseGpx } from "@engine/course/parseGpx";

const SIMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194">
        <ele>10</ele>
      </trkpt>
      <trkpt lat="37.7759" lon="-122.4194">
        <ele>15</ele>
      </trkpt>
      <trkpt lat="37.7769" lon="-122.4194">
        <ele>20</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const MULTI_SEGMENT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="37.0" lon="-122.0"><ele>10</ele></trkpt>
      <trkpt lat="37.001" lon="-122.0"><ele>20</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="37.001" lon="-122.0"><ele>20</ele></trkpt>
      <trkpt lat="37.002" lon="-122.0"><ele>30</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("parseGpx", () => {
  it("parses track points from a simple GPX", () => {
    const result = parseGpx(SIMPLE_GPX);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ lat: 37.7749, lon: -122.4194, ele: 10 });
    expect(result[1]).toEqual({ lat: 37.7759, lon: -122.4194, ele: 15 });
    expect(result[2]).toEqual({ lat: 37.7769, lon: -122.4194, ele: 20 });
  });

  it("concatenates multiple track segments", () => {
    const result = parseGpx(MULTI_SEGMENT_GPX);
    expect(result.length).toBe(4);
  });

  it("throws on empty or invalid GPX", () => {
    expect(() => parseGpx("")).toThrow();
    expect(() => parseGpx("<gpx></gpx>")).toThrow("No track points");
  });

  it("throws when elevation is missing", () => {
    const noEle = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="37.0" lon="-122.0"></trkpt>
</trkseg></trk></gpx>`;
    expect(() => parseGpx(noEle)).toThrow("elevation");
  });
});
