export type WorkoutType = "easy" | "recovery" | "long" | "progression" | "tempo" | "threshold_intervals" | "vo2max_intervals" | "hill_repeats" | "race_pace" | "fartlek";
export type SegmentType = "warmup" | "main" | "interval" | "recovery" | "cooldown";

export interface RSegment {
  id: string; position: number; segment_type: SegmentType; repeat_count: number; duration_s: number | null; distance_m: number | null;
  pace_min_s_km: number | null; pace_max_s_km: number | null; hr_min: number | null; hr_max: number | null; power_min: number | null; power_max: number | null;
  recovery_s: number | null; instructions: string | null;
}
export interface RWorkout { id: string; day_of_week: number | null; scheduled_date: string | null; workout_type: WorkoutType; title: string; notes: string | null; position: number; segments: RSegment[] }
export interface RWeek { id: string; week_number: number; target_km: number | null; target_minutes: number | null; notes: string | null; workouts: RWorkout[] }
export interface Zone { name: string; pace_min: number | null; pace_max: number | null; hr_min: number | null; hr_max: number | null }
export interface RunningTree { id: string; client_id: string | null; name: string; description: string | null; start_date: string | null; status: "draft" | "active" | "completed" | "archived"; zones: Zone[]; weeks: RWeek[] }

export interface Activity {
  id: string; client_id: string; workout_id: string | null; performed_on: string; started_at: string | null; distance_m: number; duration_s: number;
  avg_hr: number | null; max_hr: number | null; avg_power: number | null; elevation_gain_m: number | null; source: "manual" | "gpx" | "fit"; file_id: string | null;
  title: string | null; notes: string | null; rpe: number | null;
}
