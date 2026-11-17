"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const uuid = z.string().uuid();
const ni = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const segment = z.object({
  id: uuid, position: z.number().int().min(0), segment_type: z.enum(["warmup", "main", "interval", "recovery", "cooldown"]), repeat_count: z.number().int().min(1).max(50),
  duration_s: ni(1, 36000), distance_m: ni(1, 100000), pace_min_s_km: ni(120, 1200), pace_max_s_km: ni(120, 1200), hr_min: ni(40, 230), hr_max: ni(40, 230),
  power_min: ni(0, 1000), power_max: ni(0, 1000), recovery_s: ni(0, 3600), instructions: z.string().max(500).nullable(),
});
const workout = z.object({
  id: uuid, day_of_week: ni(1, 7), scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  workout_type: z.enum(["easy", "recovery", "long", "progression", "tempo", "threshold_intervals", "vo2max_intervals", "hill_repeats", "race_pace", "fartlek"]),
  title: z.string().trim().min(1).max(120), notes: z.string().max(2000).nullable(), position: z.number().int().min(0), segments: z.array(segment).max(30),
});
const week = z.object({ id: uuid, week_number: z.number().int().min(1).max(52), target_km: z.number().min(0).max(300).nullable(), notes: z.string().max(1000).nullable(), workouts: z.array(workout).max(14) });
const zone = z.object({ name: z.string().trim().min(1).max(30), pace_min: ni(120, 1200), pace_max: ni(120, 1200), hr_min: ni(40, 230), hr_max: ni(40, 230) });
const tree = z.object({ id: uuid, name: z.string().trim().min(1).max(120), description: z.string().max(2000).nullable(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), zones: z.array(zone).max(8), weeks: z.array(week).min(1).max(52) });

export async function saveRunningProgramAction(input: unknown): Promise<ActionResult> {
  await assertCoach();
  const p = tree.safeParse(input);
  if (!p.success) { console.error("[running validate]", p.error.issues.slice(0, 3)); return fail(t.errors.saveFailed); }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_running_program", { p: p.data });
  if (error) return dbError(error, "save running");
  revalidatePath("/", "layout");
  return { ok: true };
}

const createSchema = z.object({
  name: z.string().trim().min(2, t.validation.minLength(2)).max(120), client_id: uuid.or(z.literal("")),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), weeks: z.coerce.number().int().min(1).max(52), template_id: uuid.or(z.literal("")),
});

export async function createRunningProgramAction(_: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
  const v = p.data;
  const supabase = await createClient();
  if (v.template_id) {
    const { data, error } = await supabase.rpc("copy_running_program", { p_source: v.template_id, p_client: v.client_id || null, p_name: v.name, p_start: v.start_date || null });
    if (error) return dbError(error, "copy running");
    return { ok: true, data: { id: data as string } };
  }
  const { data: prog, error } = await supabase.from("running_programs").insert({ name: v.name, client_id: v.client_id || null, start_date: v.start_date || null, status: "draft" }).select("id").single();
  if (error) return dbError(error, "create running");
  const { error: wErr } = await supabase.from("running_weeks").insert(Array.from({ length: v.weeks }, (_, i) => ({ program_id: prog.id, week_number: i + 1 })));
  if (wErr) return dbError(wErr, "running weeks");
  revalidatePath("/trener/trcanje");
  return { ok: true, data: { id: prog.id as string } };
}

export async function copyRunningProgramAction(sourceId: string, clientId: string | null, name: string): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  if (!uuid.safeParse(sourceId).success || (clientId && !uuid.safeParse(clientId).success)) return fail();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_running_program", { p_source: sourceId, p_client: clientId, p_name: name, p_start: null });
  if (error) return dbError(error, "copy running");
  revalidatePath("/trener/trcanje");
  return { ok: true, data: { id: data as string } };
}
