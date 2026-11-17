import "server-only";
import { createClient } from "@/lib/supabase/server";
import { num } from "./clients";
import type { Activity, RunningTree } from "@/lib/running/types";

export async function getRunningTree(id: string): Promise<RunningTree | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: weeks }, { data: workouts }, { data: segs }] = await Promise.all([
    supabase.from("running_programs").select("id, client_id, name, description, start_date, status, zones").eq("id", id).maybeSingle(),
    supabase.from("running_weeks").select("id, week_number, target_km, notes").eq("program_id", id).order("week_number"),
    supabase.from("running_workouts").select("id, week_id, day_of_week, scheduled_date, workout_type, title, notes, position").eq("program_id", id).order("position"),
    supabase.from("running_segments").select("*").eq("program_id", id).order("position"),
  ]);
  if (!p) return null;
  return {
    ...(p as Omit<RunningTree, "weeks">),
    zones: Array.isArray(p.zones) ? p.zones : [],
    weeks: (weeks ?? []).map((w) => ({
      id: w.id, week_number: w.week_number, target_km: num(w.target_km), notes: w.notes,
      workouts: (workouts ?? []).filter((x) => x.week_id === w.id).map(({ week_id: _w, ...x }) => ({
        ...x, segments: (segs ?? []).filter((s) => s.workout_id === x.id).map(({ program_id: _p, workout_id: _wo, ...s }) => s),
      })),
    })),
  } as RunningTree;
}

export async function getActiveRunningProgramId(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("running_programs").select("id").eq("client_id", clientId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string) ?? null;
}

export async function listActivities(clientId: string, limit = 200): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("running_activities").select("*").eq("client_id", clientId).order("performed_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Activity[];
}
