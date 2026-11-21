import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { num } from "./clients";
import type { ExerciseItem, ProgramTree, PSet } from "@/lib/strength/types";

export const listExercises = cache(async (includeArchived = false): Promise<ExerciseItem[]> => {
  const supabase = await createClient();
  let q = supabase.from("exercises").select("id, name, equipment, exercise_type, movement_pattern, instructions, media_url, parent_id, is_custom, is_archived, exercise_muscles(is_primary, muscle_groups(id, name))").order("name");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q;
  if (error) throw error;
  type Row = Omit<ExerciseItem, "muscles"> & { exercise_muscles: { is_primary: boolean; muscle_groups: { id: number; name: string } }[] };
  return ((data ?? []) as unknown as Row[]).map(({ exercise_muscles, ...e }) => ({
    ...e,
    muscles: exercise_muscles.map((m) => ({ id: m.muscle_groups.id, name: m.muscle_groups.name, is_primary: m.is_primary })).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
  }));
});

export const listMuscleGroups = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("muscle_groups").select("id, slug, name").order("position");
  return (data ?? []) as { id: number; slug: string; name: string }[];
});

export async function getProgramTree(id: string): Promise<ProgramTree | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: weeks }, { data: days }, { data: ex }, { data: sets }] = await Promise.all([
    supabase.from("training_programs").select("id, client_id, name, description, start_date, status").eq("id", id).maybeSingle(),
    supabase.from("training_weeks").select("id, week_number, is_deload, notes").eq("program_id", id).order("week_number"),
    supabase.from("training_days").select("id, week_id, day_of_week, position, name, notes").eq("program_id", id).order("position"),
    supabase.from("exercise_prescriptions").select("id, day_id, exercise_id, position, superset_group, rest_seconds, tempo, notes").eq("program_id", id).order("position"),
    supabase.from("prescription_sets").select("id, prescription_id, position, set_type, reps_min, reps_max, weight_kg, rir, rpe").eq("program_id", id).order("position"),
  ]);
  if (!p) return null;
  return {
    ...(p as Omit<ProgramTree, "weeks">),
    weeks: (weeks ?? []).map((w) => ({
      id: w.id, week_number: w.week_number, is_deload: w.is_deload, notes: w.notes,
      days: (days ?? []).filter((d) => d.week_id === w.id).map((d) => ({
        id: d.id, day_of_week: d.day_of_week, position: d.position, name: d.name, notes: d.notes,
        exercises: (ex ?? []).filter((e) => e.day_id === d.id).map((e) => ({
          id: e.id, exercise_id: e.exercise_id, position: e.position, superset_group: e.superset_group, rest_seconds: e.rest_seconds, tempo: e.tempo, notes: e.notes,
          sets: (sets ?? []).filter((s) => s.prescription_id === e.id).map((s) => ({
            id: s.id, position: s.position, set_type: s.set_type, reps_min: s.reps_min, reps_max: s.reps_max, weight_kg: num(s.weight_kg), rir: num(s.rir), rpe: num(s.rpe),
          }) as PSet),
        })),
      })),
    })),
  } as ProgramTree;
}

export interface ProgramListItem { id: string; client_id: string | null; client_name: string | null; name: string; status: ProgramTree["status"]; start_date: string | null; weeks: number; updated_at: string }

export async function listPrograms(table: "training_programs" | "running_programs" | "nutrition_plans" = "training_programs"): Promise<ProgramListItem[]> {
  const supabase = await createClient();
  const weeksTable = table === "training_programs" ? "training_weeks" : table === "running_programs" ? "running_weeks" : null;
  const [{ data: programs }, { data: clients }, weeks] = await Promise.all([
    supabase.from(table).select("id, client_id, name, status, start_date, updated_at").order("updated_at", { ascending: false }),
    supabase.from("clients").select("id, full_name"),
    weeksTable ? supabase.from(weeksTable).select("program_id") : Promise.resolve({ data: [] as { program_id: string }[] }),
  ]);
  const names = new Map((clients ?? []).map((c) => [c.id as string, c.full_name as string]));
  const count = new Map<string, number>();
  for (const w of (weeks.data ?? []) as { program_id: string }[]) count.set(w.program_id, (count.get(w.program_id) ?? 0) + 1);
  return (programs ?? []).map((p) => ({ ...(p as Omit<ProgramListItem, "client_name" | "weeks">), client_name: p.client_id ? names.get(p.client_id as string) ?? null : null, weeks: count.get(p.id as string) ?? 0 }));
}

export interface SessionRow { id: string; program_id: string | null; training_day_id: string | null; name: string; performed_on: string; started_at: string | null; finished_at: string | null; status: string; notes: string | null }
export interface LoggedSet { session_id: string; exercise_id: string; exercise_position: number; position: number; set_type: "warmup" | "working" | "dropset"; reps: number | null; weight_kg: number | null; rir: number | null; is_completed: boolean; is_skipped: boolean }

export async function getActiveProgramId(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("training_programs").select("id").eq("client_id", clientId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string) ?? null;
}

export async function listSessions(clientId: string, opts: { since?: string; limit?: number } = {}): Promise<SessionRow[]> {
  const supabase = await createClient();
  let q = supabase.from("workout_sessions").select("id, program_id, training_day_id, name, performed_on, started_at, finished_at, status, notes").eq("client_id", clientId).order("performed_on", { ascending: false }).order("finished_at", { ascending: false });
  if (opts.since) q = q.gte("performed_on", opts.since);
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data ?? []) as SessionRow[];
}

export async function getSessionSets(sessionIds: string[]): Promise<LoggedSet[]> {
  if (!sessionIds.length) return [];
  const supabase = await createClient();
  const out: LoggedSet[] = [];
  for (let i = 0; i < sessionIds.length; i += 200) {
    const { data } = await supabase.from("workout_sets").select("session_id, exercise_id, exercise_position, position, set_type, reps, weight_kg, rir, is_completed, is_skipped").in("session_id", sessionIds.slice(i, i + 200)).order("exercise_position").order("position");
    out.push(...((data ?? []) as LoggedSet[]).map((s) => ({ ...s, weight_kg: num(s.weight_kg), rir: num(s.rir) })));
  }
  return out;
}

/** The most recent completed sets for each exercise, from the client's earlier workouts. */
export async function getPreviousPerformance(clientId: string, exerciseIds: string[], excludeSession?: string): Promise<Record<string, { date: string; sets: { reps: number | null; weight_kg: number | null }[] }>> {
  if (!exerciseIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("workout_sets")
    .select("exercise_id, position, reps, weight_kg, set_type, session:workout_sessions!inner(id, client_id, performed_on, status)")
    .eq("session.client_id", clientId).eq("session.status", "completed").eq("is_completed", true).neq("set_type", "warmup")
    .in("exercise_id", exerciseIds).order("position");
  type Row = { exercise_id: string; position: number; reps: number | null; weight_kg: unknown; session: { id: string; performed_on: string } };
  const best: Record<string, { date: string; session: string; sets: { reps: number | null; weight_kg: number | null }[] }> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.session.id === excludeSession) continue;
    const cur = best[r.exercise_id];
    if (!cur || r.session.performed_on > cur.date) best[r.exercise_id] = { date: r.session.performed_on, session: r.session.id, sets: [] };
    if (best[r.exercise_id].session === r.session.id) best[r.exercise_id].sets.push({ reps: r.reps, weight_kg: num(r.weight_kg) });
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, { date: v.date, sets: v.sets }]));
}

export interface ExerciseHistory { sessions: { date: string; sets: { reps: number | null; weight_kg: number | null; set_type: string }[] }[]; bestE1RM: number | null; bestWeight: number | null }

/** Last sessions and all-time bests per exercise (for PR detection and the exercise sheet). */
export async function getExerciseHistory(clientId: string, exerciseIds: string[], excludeSession?: string): Promise<Record<string, ExerciseHistory>> {
  if (!exerciseIds.length) return {};
  const { estimateOneRepMax } = await import("@/lib/utils/training");
  const supabase = await createClient();
  const { data } = await supabase.from("workout_sets")
    .select("exercise_id, position, reps, weight_kg, set_type, session:workout_sessions!inner(id, client_id, performed_on, status)")
    .eq("session.client_id", clientId).eq("session.status", "completed").eq("is_completed", true)
    .in("exercise_id", exerciseIds).order("position").limit(4000);
  type Row = { exercise_id: string; reps: number | null; weight_kg: unknown; set_type: string; session: { id: string; performed_on: string } };
  const out: Record<string, ExerciseHistory & { bySession: Map<string, { date: string; sets: ExerciseHistory["sessions"][number]["sets"] }> }> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.session.id === excludeSession) continue;
    const h = (out[r.exercise_id] ??= { sessions: [], bestE1RM: null, bestWeight: null, bySession: new Map() });
    const w = num(r.weight_kg);
    const ses = h.bySession.get(r.session.id) ?? { date: r.session.performed_on, sets: [] };
    ses.sets.push({ reps: r.reps, weight_kg: w, set_type: r.set_type });
    h.bySession.set(r.session.id, ses);
    if (r.set_type !== "warmup") {
      const e = estimateOneRepMax(w, r.reps);
      if (e != null && (h.bestE1RM == null || e > h.bestE1RM)) h.bestE1RM = e;
      if (w != null && w > 0 && (h.bestWeight == null || w > h.bestWeight)) h.bestWeight = w;
    }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, {
    bestE1RM: v.bestE1RM, bestWeight: v.bestWeight,
    sessions: [...v.bySession.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
  }]));
}

export async function getStrengthAnalytics(clientId: string, weeks = 12) {
  const { computeStrengthAnalytics } = await import("@/lib/strength/analytics");
  const sessions = (await listSessions(clientId)).filter((s) => s.status === "completed");
  const sets = await getSessionSets(sessions.map((s) => s.id));
  const date = new Map(sessions.map((s) => [s.id, s.performed_on]));
  return {
    analytics: computeStrengthAnalytics(sets.map((s) => ({ ...s, performed_on: date.get(s.session_id)! })), sessions.length, weeks),
    sessions,
  };
}
