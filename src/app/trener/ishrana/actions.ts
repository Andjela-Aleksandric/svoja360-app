"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const uuid = z.string().uuid();
const item = z.object({ id: uuid, food_id: uuid, quantity_g: z.number().gt(0).max(3000), alternative_to: uuid.nullable(), position: z.number().int().min(0), notes: z.string().max(300).nullable() });
const meal = z.object({ id: uuid, position: z.number().int().min(0), name: z.string().trim().min(1).max(80), meal_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(), instructions: z.string().max(2000).nullable(), items: z.array(item).max(40) });
const day = z.object({ id: uuid, position: z.number().int().min(0), name: z.string().trim().min(1).max(80), notes: z.string().max(1000).nullable(), meals: z.array(meal).max(10) });
const ni = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const tree = z.object({
  id: uuid, name: z.string().trim().min(1).max(120), kcal_target: ni(800, 6000), protein_g: ni(0, 500), carbs_g: ni(0, 1000), fat_g: ni(0, 400),
  notes: z.string().max(3000).nullable(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), days: z.array(day).max(7),
});

export async function saveNutritionPlanAction(input: unknown): Promise<ActionResult> {
  await assertCoach();
  const p = tree.safeParse(input);
  if (!p.success) { console.error("[nutrition validate]", p.error.issues.slice(0, 3)); return fail(t.errors.saveFailed); }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_nutrition_plan", { p: p.data });
  if (error) return dbError(error, "save nutrition");
  revalidatePath("/", "layout");
  return { ok: true };
}

const createSchema = z.object({
  name: z.string().trim().min(2, t.validation.minLength(2)).max(120), client_id: uuid.or(z.literal("")),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")), template_id: uuid.or(z.literal("")),
});

export async function createNutritionPlanAction(_: unknown, fd: FormData): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
  const v = p.data;
  const supabase = await createClient();
  if (v.template_id) {
    const { data, error } = await supabase.rpc("copy_nutrition_plan", { p_source: v.template_id, p_client: v.client_id || null, p_name: v.name, p_start: v.start_date || null });
    if (error) return dbError(error, "copy nutrition");
    return { ok: true, data: { id: data as string } };
  }
  const { data: plan, error } = await supabase.from("nutrition_plans").insert({ name: v.name, client_id: v.client_id || null, start_date: v.start_date || null, status: "draft" }).select("id").single();
  if (error) return dbError(error, "create nutrition");
  await supabase.from("nutrition_plan_days").insert([{ plan_id: plan.id, position: 0, name: t.nutrition.trainingDay }, { plan_id: plan.id, position: 1, name: t.nutrition.restDay }]);
  revalidatePath("/trener/ishrana");
  return { ok: true, data: { id: plan.id as string } };
}

export async function copyNutritionPlanAction(sourceId: string, clientId: string | null, name: string): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  if (!uuid.safeParse(sourceId).success || (clientId && !uuid.safeParse(clientId).success)) return fail();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_nutrition_plan", { p_source: sourceId, p_client: clientId, p_name: name, p_start: null });
  if (error) return dbError(error, "copy nutrition");
  return { ok: true, data: { id: data as string } };
}

export async function saveMealTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  const p = meal.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { data, error } = await supabase.from("meals").insert({ is_template: true, plan_id: null, plan_day_id: null, position: 0, name: p.data.name, meal_time: p.data.meal_time, instructions: p.data.instructions }).select("id").single();
  if (error) return dbError(error, "meal template");
  const idMap = new Map(p.data.items.map((i) => [i.id, crypto.randomUUID()]));
  const rows = [...p.data.items].sort((a, b) => Number(!!a.alternative_to) - Number(!!b.alternative_to))
    .map((i) => ({ id: idMap.get(i.id), meal_id: data.id, plan_id: null, food_id: i.food_id, quantity_g: i.quantity_g, alternative_to: i.alternative_to ? idMap.get(i.alternative_to) ?? null : null, position: i.position, notes: i.notes }));
  for (const r of rows) {
    const { error: e } = await supabase.from("meal_items").insert(r);
    if (e) { await supabase.from("meals").delete().eq("id", data.id); return dbError(e, "meal template items"); }
  }
  revalidatePath("/trener/ishrana", "layout");
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteMealTemplateAction(id: string): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(id).success) return fail();
  const supabase = await createClient();
  const { error } = await supabase.from("meals").delete().eq("id", id).eq("is_template", true);
  if (error) return dbError(error, "delete meal template");
  revalidatePath("/trener/ishrana", "layout");
  return { ok: true };
}
