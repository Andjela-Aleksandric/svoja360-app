export interface LoggedSet {
  weight_kg: number | null;
  reps: number | null;
  set_type: "warmup" | "working" | "dropset";
  is_completed: boolean;
}

/** Epley estimate. Only reliable up to ~12 reps, so higher rep sets return null. */
export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round1(weightKg);
  if (reps > 12) return null;
  return round1(weightKg * (1 + reps / 30));
}

/** Volume = weight × reps for completed working and drop sets. Warm-up sets are excluded. */
export function setVolume(set: LoggedSet): number {
  if (!set.is_completed || set.set_type === "warmup") return 0;
  return (set.weight_kg ?? 0) * (set.reps ?? 0);
}

export function totalVolume(sets: LoggedSet[]): number {
  return round1(sets.reduce((sum, s) => sum + setVolume(s), 0));
}

/** Bodyweight exercises log 0 kg; count completed reps separately so they still show progress. */
export function totalReps(sets: LoggedSet[]): number {
  return sets.filter((s) => s.is_completed && s.set_type !== "warmup").reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function bestE1RM(sets: LoggedSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!s.is_completed || s.set_type === "warmup") continue;
    const e = estimateOneRepMax(s.weight_kg, s.reps);
    if (e !== null && (best === null || e > best)) best = e;
  }
  return best;
}

/** Linear progression for week n (1-based) from week 1 values. */
export function progressValue(base: number | null, perWeek: number, week: number): number | null {
  if (base === null || base === undefined) return null;
  return round1(base + perWeek * (week - 1));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatRest(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m > 0 ? (s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`) : `${s} s`;
}
