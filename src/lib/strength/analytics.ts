import { estimateOneRepMax, setVolume } from "@/lib/utils/training";
import { weekStart } from "@/lib/utils/periods";

export interface AnalyticsSet { performed_on: string; exercise_id: string; reps: number | null; weight_kg: number | null; set_type: "warmup" | "working" | "dropset"; is_completed: boolean }

export interface StrengthAnalytics {
  weeklyVolume: { date: string; value: number }[];
  e1rm: Record<string, { date: string; value: number }[]>;
  prs: { exercise_id: string; e1rm: number | null; e1rmDate: string | null; maxWeight: number | null; maxWeightReps: number | null; maxWeightDate: string | null; sessions: number }[];
  totalVolume: number;
  sessions: number;
}

/** Pure computation so it can be unit tested and run on the server. */
export function computeStrengthAnalytics(sets: AnalyticsSet[], sessionsCount: number, weeks = 12, today = new Date().toISOString().slice(0, 10)): StrengthAnalytics {
  const done = sets.filter((s) => s.is_completed && s.set_type !== "warmup");
  const thisWeek = weekStart(today);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(thisWeek + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - i * 7); starts.push(d.toISOString().slice(0, 10));
  }
  const vol = new Map(starts.map((s) => [s, 0]));
  for (const s of done) { const w = weekStart(s.performed_on); if (vol.has(w)) vol.set(w, vol.get(w)! + setVolume({ ...s, is_completed: true })); }

  const e1: Record<string, Map<string, number>> = {};
  const pr = new Map<string, StrengthAnalytics["prs"][number] & { days: Set<string> }>();
  for (const s of done) {
    const est = estimateOneRepMax(s.weight_kg, s.reps);
    if (est != null) {
      const m = (e1[s.exercise_id] ??= new Map());
      m.set(s.performed_on, Math.max(m.get(s.performed_on) ?? 0, est));
    }
    const p = pr.get(s.exercise_id) ?? { exercise_id: s.exercise_id, e1rm: null, e1rmDate: null, maxWeight: null, maxWeightReps: null, maxWeightDate: null, sessions: 0, days: new Set<string>() };
    p.days.add(s.performed_on);
    if (est != null && (p.e1rm == null || est > p.e1rm)) { p.e1rm = est; p.e1rmDate = s.performed_on; }
    if (s.weight_kg != null && (p.maxWeight == null || s.weight_kg > p.maxWeight || (s.weight_kg === p.maxWeight && (s.reps ?? 0) > (p.maxWeightReps ?? 0)))) { p.maxWeight = s.weight_kg; p.maxWeightReps = s.reps; p.maxWeightDate = s.performed_on; }
    pr.set(s.exercise_id, p);
  }
  return {
    weeklyVolume: starts.map((d) => ({ date: d, value: Math.round(vol.get(d)!) })),
    e1rm: Object.fromEntries(Object.entries(e1).map(([k, m]) => [k, [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }))])),
    prs: [...pr.values()].map(({ days, ...p }) => ({ ...p, sessions: days.size })).sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0)),
    totalVolume: Math.round(done.reduce((sum, s) => sum + setVolume({ ...s, is_completed: true }), 0)),
    sessions: sessionsCount,
  };
}
