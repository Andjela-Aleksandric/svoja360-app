// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseGpx } from "./parse";

const gpx = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Jutarnje trčanje</name><trkseg>
<trkpt lat="44.8000" lon="20.4600"><ele>100</ele><time>2026-11-15T07:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="44.8090" lon="20.4600"><ele>110</ele><time>2026-11-15T07:05:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="44.8180" lon="20.4600"><ele>105</ele><time>2026-11-15T07:10:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
</trkseg></trk></gpx>`;

describe("GPX parsing", () => {
  it("computes distance, duration, elevation gain and heart rate", () => {
    const a = parseGpx(gpx);
    expect(a.distance_m).toBeGreaterThan(1990);
    expect(a.distance_m).toBeLessThan(2010);
    expect(a.duration_s).toBe(600);
    expect(a.elevation_gain_m).toBe(10);
    expect(a.avg_hr).toBe(150);
    expect(a.max_hr).toBe(160);
    expect(a.performed_on).toBe("2026-11-15");
    expect(a.title).toBe("Jutarnje trčanje");
  });
  it("rejects files without a track", () => {
    expect(() => parseGpx("<gpx></gpx>")).toThrow();
  });
});
