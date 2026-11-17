"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const uuid = z.string().uuid();
const n = (min: number, max: number) => z.number().min(min).max(max).nullable();

const setSchema = z.object({ id: uuid, position: z.number().int().min(0), set_type: z.enum(["warmup", "working", "dropset"]), reps_min: n(0, 100), reps_max: n(0, 100), weight_kg: n(0, 500), rir: n(0, 10), rpe: n(1, 10) })
  .refine((s) => s.reps_min == null || s.reps_max == null || s.reps_max >= s.reps_min, { message: "reps" });
const exSchema = z.object({
  id: uuid, exercise_id: uuid, position: z.number().int().min(0), superset_group: z.string().regex(/^[A-Z]$/).nullable(),
  rest_seconds: z.number().int().min(0).max(900).nullable(), tempo: z.string().regex(/^[0-9X]{4}$/i).nullable(), notes: z.string().max(1000).nullable(),
  sets: z.array(setSchema).max(20),
});
const daySchema = z.object({ id: uuid, day_of_week: z.number().int().min(1).max(7).nullable(), position: z.number().int().min(0), name: z.string().trim().min(1).max(80), notes: z.string().max(1000).nullable(), exercises: z.array(exSchema).max(30) });
const weekSchema = z.object({ id: uuid, week_number: z.number().int().min(1).max(52), is_deload: z.boolean(), notes: z.string().max(1000).nullable(), days: z.array(daySchema).max(7) });
const treeSchema = z.object({ id: uuid, name: z.string().trim().min(1).max(120), description: z.string().max(2000).nullable(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), weeks: z.array(weekSchema).min(1).max(52) });

export async function saveProgramAction(tree: unknown): Promise<ActionResult> {
  await assertCoach();
  const p = treeSchema.safeParse(tree);
  if (!p.success) { console.error("[program validate]", p.error.issues.slice(0, 3)); return fail(t.errors.saveFailed); }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_training_program", { p: p.data });
  if (error) return dbError(error, "save program");
  revalidatePath("/trener/trening", "layout");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

const createSchema = z.object({
  name: z.string().trim().min(2, t.validation.minLength(2)).max(120),
  client_id: uuid.or(z.literal("")),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  weeks: z.coerce.number().int().min(1).max(52),
  template_id: uuid.or(z.literal("")),
});

export async function createProgramAction(_: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
  const v = p.data;
  const supabase = await createClient();
  if (v.template_id) {
    const { data, error } = await supabase.rpc("copy_training_program", { p_source: v.template_id, p_client: v.client_id || null, p_name: v.name, p_start: v.start_date || null });
    if (error) return dbError(error, "copy program");
    revalidatePath("/trener/trening");
    return { ok: true, data: { id: data as string } };
  }
  const { data: prog, error } = await supabase.from("training_programs").insert({ name: v.name, client_id: v.client_id || null, start_date: v.start_date || null, status: "draft" }).select("id").single();
  if (error) return dbError(error, "create program");
  const weeks = Array.from({ length: v.weeks }, (_, i) => ({ program_id: prog.id, week_number: i + 1 }));
  const { error: wErr } = await supabase.from("training_weeks").insert(weeks);
  if (wErr) return dbError(wErr, "create weeks");
  revalidatePath("/trener/trening");
  return { ok: true, data: { id: prog.id as string } };
}

export async function setProgramStatusAction(id: string, status: "draft" | "active" | "completed" | "archived", table: "training_programs" | "running_programs" | "nutrition_plans" = "training_programs"): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(id).success || !["draft", "active", "completed", "archived"].includes(status) || !["training_programs", "running_programs", "nutrition_plans"].includes(table)) return fail();
  const supabase = await createClient();
  const { data: prog } = await supabase.from(table).select("client_id, start_date").eq("id", id).maybeSingle();
  if (!prog) return fail(t.errors.notFound);
  if (status === "active") {
    if (!prog.client_id) return fail(t.strength.needClient);
    // One active plan of a kind per client: the previous one is marked completed.
    await supabase.from(table).update({ status: "completed" }).eq("client_id", prog.client_id).eq("status", "active").neq("id", id);
  }
  const patch: Record<string, unknown> = { status };
  if (status === "active" && !prog.start_date) patch.start_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return dbError(error, "program status");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function copyProgramAction(sourceId: string, clientId: string | null, name: string): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  if (!uuid.safeParse(sourceId).success || (clientId && !uuid.safeParse(clientId).success)) return fail();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_training_program", { p_source: sourceId, p_client: clientId, p_name: name, p_start: null });
  if (error) return dbError(error, "copy program");
  revalidatePath("/trener/trening");
  return { ok: true, data: { id: data as string } };
}

export async function deleteProgramAction(id: string, table: "training_programs" | "running_programs" | "nutrition_plans" = "training_programs"): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(id).success || !["training_programs", "running_programs", "nutrition_plans"].includes(table)) return fail();
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return dbError(error, "delete program");
  revalidatePath("/", "layout");
  return { ok: true };
}
