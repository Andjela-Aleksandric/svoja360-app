export type SetType = "warmup" | "working" | "dropset";

export interface PSet { id: string; position: number; set_type: SetType; reps_min: number | null; reps_max: number | null; weight_kg: number | null; rir: number | null; rpe: number | null }
export interface PExercise { id: string; exercise_id: string; position: number; superset_group: string | null; rest_seconds: number | null; tempo: string | null; notes: string | null; sets: PSet[] }
export interface PDay { id: string; day_of_week: number | null; position: number; name: string; notes: string | null; exercises: PExercise[] }
export interface PWeek { id: string; week_number: number; is_deload: boolean; notes: string | null; days: PDay[] }
export interface ProgramTree {
  id: string; client_id: string | null; name: string; description: string | null; start_date: string | null;
  status: "draft" | "active" | "completed" | "archived"; weeks: PWeek[];
}

export interface ExerciseItem {
  id: string; name: string; equipment: string; exercise_type: string; movement_pattern: string; instructions: string | null; media_url: string | null;
  parent_id: string | null; is_custom: boolean; is_archived: boolean; muscles: { id: number; name: string; is_primary: boolean }[];
}

/** Which program week is "current" for a given date. Week 1 starts on start_date. */
export function currentWeekNumber(startDate: string | null, today: string, weeks: number): number {
  if (!startDate || weeks < 1) return 1;
  const days = Math.floor((Date.parse(today + "T12:00:00Z") - Date.parse(startDate + "T12:00:00Z")) / 86400000);
  if (days < 0) return 1;
  return Math.min(weeks, Math.floor(days / 7) + 1);
}

export function formatReps(min: number | null, max: number | null): string {
  if (min == null && max == null) return "–";
  if (min != null && max != null && min !== max) return `${min}-${max}`;
  return String(min ?? max);
}
