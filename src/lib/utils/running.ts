/** Pace in seconds per km. */
export function paceSecondsPerKm(distanceM: number, durationS: number): number | null {
  if (!distanceM || !durationS || distanceM <= 0 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/** 330 -> "5:30" */
export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || secPerKm <= 0) return "–";
  const m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "5:30" -> 330. Returns null when invalid. */
export function parsePace(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = String(input).trim().match(/^(\d{1,2})[:.,](\d{2})$/);
  if (!m) return null;
  const sec = Number(m[2]);
  if (sec >= 60) return null;
  return Number(m[1]) * 60 + sec;
}

/** 3725 -> "1:02:05", 605 -> "10:05" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "–";
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.round(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** "1:02:05" | "62:05" | "45" (minutes) -> seconds */
export function parseDuration(input: string | null | undefined): number | null {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d+$/.test(s)) return Number(s) * 60;
  const parts = s.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export interface Segment {
  repeat_count: number;
  duration_s: number | null;
  distance_m: number | null;
  pace_min_s_km: number | null;
  pace_max_s_km: number | null;
  recovery_s: number | null;
}

/** Planned distance of a structured workout. Duration-only segments use the middle of the target pace. */
export function estimateWorkoutDistanceM(segments: Segment[]): number {
  let total = 0;
  for (const seg of segments) {
    const reps = seg.repeat_count || 1;
    if (seg.distance_m) total += seg.distance_m * reps;
    else if (seg.duration_s) {
      const pace = midPace(seg);
      if (pace) total += (seg.duration_s / pace) * 1000 * reps;
    }
  }
  return Math.round(total);
}

export function estimateWorkoutDurationS(segments: Segment[]): number {
  let total = 0;
  for (const seg of segments) {
    const reps = seg.repeat_count || 1;
    let one = seg.duration_s ?? 0;
    if (!one && seg.distance_m) {
      const pace = midPace(seg);
      if (pace) one = (seg.distance_m / 1000) * pace;
    }
    total += one * reps + (seg.recovery_s ?? 0) * Math.max(0, reps - 1);
  }
  return Math.round(total);
}

function midPace(seg: Segment): number | null {
  if (seg.pace_min_s_km && seg.pace_max_s_km) return (seg.pace_min_s_km + seg.pace_max_s_km) / 2;
  return seg.pace_min_s_km ?? seg.pace_max_s_km ?? null;
}

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
