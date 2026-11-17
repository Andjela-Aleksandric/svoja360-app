import { weekStart } from "@/lib/utils/periods";
import { paceSecondsPerKm } from "@/lib/utils/running";

export interface RunLike { performed_on: string; distance_m: number; duration_s: number }

export function computeRunningAnalytics(runs: RunLike[], weeks = 12, today = new Date().toISOString().slice(0, 10)) {
  const thisWeek = weekStart(today);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) { const d = new Date(thisWeek + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - i * 7); starts.push(d.toISOString().slice(0, 10)); }
  const km = new Map(starts.map((s) => [s, 0]));
  const count = new Map(starts.map((s) => [s, 0]));
  for (const r of runs) { const w = weekStart(r.performed_on); if (km.has(w)) { km.set(w, km.get(w)! + r.distance_m / 1000); count.set(w, count.get(w)! + 1); } }
  const sorted = [...runs].sort((a, b) => a.performed_on.localeCompare(b.performed_on));
  const totalM = runs.reduce((s, r) => s + r.distance_m, 0);
  const totalS = runs.reduce((s, r) => s + r.duration_s, 0);
  const longest = runs.reduce<RunLike | null>((b, r) => (!b || r.distance_m > b.distance_m ? r : b), null);
  const recentWeeks = starts.slice(-4);
  return {
    weeklyKm: starts.map((d) => ({ date: d, value: Math.round(km.get(d)! * 10) / 10 })),
    pace: sorted.filter((r) => r.distance_m >= 1000).map((r) => ({ date: r.performed_on, value: Math.round(paceSecondsPerKm(r.distance_m, r.duration_s) ?? 0) })),
    totalKm: Math.round(totalM / 100) / 10,
    avgPace: totalM ? paceSecondsPerKm(totalM, totalS) : null,
    longest,
    runsPerWeek: Math.round((recentWeeks.reduce((s, w) => s + count.get(w)!, 0) / recentWeeks.length) * 10) / 10,
  };
}
