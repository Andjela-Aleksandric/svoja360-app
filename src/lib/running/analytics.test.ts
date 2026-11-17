import { describe, expect, it } from "vitest";
import { computeRunningAnalytics } from "./analytics";

describe("running analytics", () => {
  const runs = [
    { performed_on: "2026-11-03", distance_m: 5000, duration_s: 1800 },
    { performed_on: "2026-11-05", distance_m: 8000, duration_s: 2880 },
    { performed_on: "2026-11-12", distance_m: 12000, duration_s: 4500 },
  ];
  const a = computeRunningAnalytics(runs, 3, "2026-11-17");
  it("sums kilometres per Monday–Sunday week", () => {
    expect(a.weeklyKm.map((w) => w.value)).toEqual([13, 12, 0]);
    expect(a.totalKm).toBe(25);
  });
  it("finds longest run and average pace", () => {
    expect(a.longest?.distance_m).toBe(12000);
    expect(a.avgPace).toBe(367);
    expect(a.pace.map((p) => p.value)).toEqual([360, 360, 375]);
  });
});
