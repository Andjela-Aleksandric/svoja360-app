import { describe, expect, it } from "vitest";
import { addDays, ageFromBirthDate, formatDate, formatNumber, isoWeekday, parseDecimal, todayISO } from "./format";
import { normalizePhone, whatsappLink, formatPhone } from "./phone";
import { previousWeek, weekStart, isPastDeadline, lastPeriods } from "./periods";
import { estimateOneRepMax, totalVolume, bestE1RM, progressValue } from "./training";
import { formatPace, parsePace, paceSecondsPerKm, formatDuration, parseDuration, estimateWorkoutDistanceM, haversineM } from "./running";
import { macrosFor, sumMacros, kcalFromMacros } from "./nutrition";

describe("format", () => {
  it("formats Serbian dates", () => {
    expect(formatDate("2026-11-09")).toBe("9.11.2026.");
  });
  it("formats numbers with decimal comma", () => {
    expect(formatNumber(68.4)).toBe("68,4");
    expect(formatNumber(12345.67, 1)).toBe("12.345,7");
    expect(formatNumber(70, 1)).toBe("70");
    expect(formatNumber(-1.25, 2)).toBe("-1,25");
  });
  it("parses decimals typed either way", () => {
    expect(parseDecimal("68,4")).toBe(68.4);
    expect(parseDecimal(" 68.4 ")).toBe(68.4);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
  it("weekday and day arithmetic", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("age", () => {
    expect(ageFromBirthDate("1980-11-18", "2026-11-17")).toBe(45);
    expect(ageFromBirthDate("1980-11-17", "2026-11-17")).toBe(46);
  });
  it("today in Belgrade crosses midnight correctly", () => {
    expect(todayISO(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-17");
  });
});

describe("phone", () => {
  it("normalises Serbian numbers", () => {
    expect(normalizePhone("064 123 4567")).toBe("+381641234567");
    expect(normalizePhone("+381 64 123-4567")).toBe("+381641234567");
    expect(normalizePhone("00381641234567")).toBe("+381641234567");
    expect(normalizePhone("+381 (0)64 1234567")).toBe("+381641234567");
    expect(normalizePhone("+43 660 1234567")).toBe("+436601234567");
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("builds wa.me links", () => {
    expect(whatsappLink("+381641234567")).toBe("https://wa.me/381641234567");
    expect(whatsappLink("+381641234567", "Zdravo")).toBe("https://wa.me/381641234567?text=Zdravo");
    expect(whatsappLink(null)).toBeNull();
    expect(formatPhone("+381641234567")).toBe("+381 64 123 4567");
  });
});

describe("periods", () => {
  it("previous week is Monday–Sunday", () => {
    expect(previousWeek("2026-11-17")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(previousWeek("2026-11-16")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(previousWeek("2026-11-22")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
  });
  it("deadline", () => {
    const p = { start: "2026-11-09", end: "2026-11-15" };
    expect(isPastDeadline(p, { weekday: 1, hour: 20 }, "2026-11-16", 19)).toBe(false);
    expect(isPastDeadline(p, { weekday: 1, hour: 20 }, "2026-11-16", 20)).toBe(true);
    expect(isPastDeadline(p, { weekday: 2, hour: 12 }, "2026-11-16", 23)).toBe(false);
  });
  it("lists periods newest first", () => {
    const l = lastPeriods(3, "2026-11-17");
    expect(l.map((p) => p.start)).toEqual(["2026-11-09", "2026-11-02", "2026-10-26"]);
  });
});

describe("training", () => {
  it("estimates 1RM with Epley", () => {
    expect(estimateOneRepMax(60, 5)).toBe(70);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(50, 15)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
  it("volume excludes warm-ups and incomplete sets", () => {
    const sets = [
      { weight_kg: 40, reps: 10, set_type: "warmup" as const, is_completed: true },
      { weight_kg: 60, reps: 8, set_type: "working" as const, is_completed: true },
      { weight_kg: 60, reps: 8, set_type: "working" as const, is_completed: false },
      { weight_kg: 40, reps: 12, set_type: "dropset" as const, is_completed: true },
    ];
    expect(totalVolume(sets)).toBe(960);
    expect(bestE1RM(sets)).toBe(76);
  });
  it("linear progression", () => {
    expect(progressValue(50, 2.5, 1)).toBe(50);
    expect(progressValue(50, 2.5, 4)).toBe(57.5);
    expect(progressValue(null, 2.5, 4)).toBeNull();
  });
});

describe("running", () => {
  it("pace helpers", () => {
    expect(paceSecondsPerKm(10000, 3300)).toBe(330);
    expect(formatPace(330)).toBe("5:30");
    expect(formatPace(359.6)).toBe("6:00");
    expect(parsePace("5:30")).toBe(330);
    expect(parsePace("5.05")).toBe(305);
    expect(parsePace("5:75")).toBeNull();
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("1:02:05")).toBe(3725);
  });
  it("estimates structured workout distance", () => {
    const segs = [
      { repeat_count: 1, duration_s: 900, distance_m: null, pace_min_s_km: 360, pace_max_s_km: 360, recovery_s: null },
      { repeat_count: 5, duration_s: null, distance_m: 1000, pace_min_s_km: 270, pace_max_s_km: 270, recovery_s: 120 },
    ];
    expect(estimateWorkoutDistanceM(segs)).toBe(7500);
  });
  it("haversine", () => {
    // Roughly 1 degree of latitude ~ 111.2 km
    expect(Math.round(haversineM(44, 20, 45, 20) / 100) / 10).toBe(111.2);
  });
});

describe("nutrition", () => {
  it("calculates macros by grams", () => {
    const oats = { kcal_100g: 379, protein_100g: 13.2, carbs_100g: 67.7, fat_100g: 6.5, fiber_100g: 10.1 };
    const m = macrosFor(oats, 50);
    expect(m.kcal).toBeCloseTo(189.5);
    expect(m.protein).toBeCloseTo(6.6);
    const total = sumMacros([m, m]);
    expect(total.kcal).toBeCloseTo(379);
    expect(kcalFromMacros(100, 200, 60)).toBe(1740);
  });
});
