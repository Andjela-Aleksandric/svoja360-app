import { describe, expect, it } from "vitest";
import { computeStrengthAnalytics } from "./analytics";
import { currentWeekNumber } from "./types";

describe("strength analytics", () => {
  const sets = [
    { performed_on: "2026-11-02", exercise_id: "sq", reps: 8, weight_kg: 40, set_type: "working" as const, is_completed: true },
    { performed_on: "2026-11-02", exercise_id: "sq", reps: 10, weight_kg: 20, set_type: "warmup" as const, is_completed: true },
    { performed_on: "2026-11-10", exercise_id: "sq", reps: 8, weight_kg: 42.5, set_type: "working" as const, is_completed: true },
    { performed_on: "2026-11-10", exercise_id: "sq", reps: 8, weight_kg: 45, set_type: "working" as const, is_completed: false },
  ];
  const a = computeStrengthAnalytics(sets, 2, 4, "2026-11-17");
  it("excludes warm-ups and unfinished sets from volume", () => {
    expect(a.totalVolume).toBe(320 + 340);
    expect(a.weeklyVolume.map((w) => w.value)).toEqual([0, 320, 340, 0]);
  });
  it("tracks e1RM and personal records", () => {
    expect(a.e1rm.sq.map((p) => p.value)).toEqual([50.7, 53.8]);
    expect(a.prs[0]).toMatchObject({ exercise_id: "sq", maxWeight: 42.5, e1rmDate: "2026-11-10", sessions: 2 });
  });
  it("finds the current program week", () => {
    expect(currentWeekNumber("2026-11-09", "2026-11-17", 4)).toBe(2);
    expect(currentWeekNumber("2026-11-09", "2027-01-30", 4)).toBe(4);
    expect(currentWeekNumber("2026-12-01", "2026-11-17", 4)).toBe(1);
  });
});
