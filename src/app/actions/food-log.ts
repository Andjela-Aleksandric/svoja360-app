"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slot = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const r1 = (v: number) => Math.round(v * 10) / 10;

const foodItem = z.object({ food_id: uuid, quantity_g: z.number().min(1).max(5000) });
const addSchema = z.object({ date, slot, items: z.array(foodItem).min(1).max(30) });

/** Adds foods from the library. Macros are calculated here from the food table, never trusted from the browser. */
export async function addFoodsAction(input: unknown): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const p = addSchema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { data: foods, error: fErr } = await supabase.from("foods").select("id, name, kcal_100g, protein_100g, carbs_100g, fat_100g").in("id", p.data.items.map((i) => i.food_id));
  if (fErr) return dbError(fErr, "foods for log");
  const byId = new Map((foods ?? []).map((f) => [f.id as string, f]));
  const rows = p.data.items.flatMap((i) => {
    const f = byId.get(i.food_id);
    if (!f) return [];
    const k = i.quantity_g / 100;
    return [{ client_id: v.client.id, logged_on: p.data.date, meal_slot: p.data.slot, food_id: i.food_id, name: String(f.name).slice(0, 120), quantity_g: r1(i.quantity_g),
      kcal: r1(Number(f.kcal_100g) * k), protein_g: r1(Number(f.protein_100g) * k), carbs_g: r1(Number(f.carbs_100g) * k), fat_g: r1(Number(f.fat_100g) * k) }];
  });
  if (!rows.length) return fail(t.errors.notFound);
  const { error } = await supabase.from("food_log_entries").insert(rows);
  if (error) return dbError(error, "add food log");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

const quickSchema = z.object({
  date, slot, name: z.string().trim().min(1).max(120), kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000).nullable(), carbs_g: z.number().min(0).max(1000).nullable(), fat_g: z.number().min(0).max(1000).nullable(),
});

/** Quick add: just a name and calories (macros optional), for food that is not in the library. */
export async function quickAddAction(input: unknown): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const p = quickSchema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { error } = await supabase.from("food_log_entries").insert({
    client_id: v.client.id, logged_on: p.data.date, meal_slot: p.data.slot, food_id: null, name: p.data.name, quantity_g: null,
    kcal: r1(p.data.kcal), protein_g: r1(p.data.protein_g ?? 0), carbs_g: r1(p.data.carbs_g ?? 0), fat_g: r1(p.data.fat_g ?? 0),
  });
  if (error) return dbError(error, "quick add");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

/** Change the amount of a logged food (macros scale with it). */
export async function updateFoodEntryAction(id: string, quantity_g: number): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(id).success || !(quantity_g >= 1 && quantity_g <= 5000)) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { data: e } = await supabase.from("food_log_entries").select("food_id, quantity_g").eq("id", id).eq("client_id", v.client.id).maybeSingle();
  if (!e?.food_id) return fail(t.errors.notFound);
  const { data: f } = await supabase.from("foods").select("kcal_100g, protein_100g, carbs_100g, fat_100g").eq("id", e.food_id).maybeSingle();
  if (!f) return fail(t.errors.notFound);
  const k = quantity_g / 100;
  const { error } = await supabase.from("food_log_entries").update({
    quantity_g: r1(quantity_g), kcal: r1(Number(f.kcal_100g) * k), protein_g: r1(Number(f.protein_100g) * k), carbs_g: r1(Number(f.carbs_100g) * k), fat_g: r1(Number(f.fat_100g) * k),
  }).eq("id", id).eq("client_id", v.client.id);
  if (error) return dbError(error, "update food log");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

export async function deleteFoodEntryAction(id: string): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(id).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { error } = await supabase.from("food_log_entries").delete().eq("id", id).eq("client_id", v.client.id);
  if (error) return dbError(error, "delete food log");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

/** Copies every food of a day (from a date) into another date. Handy for repeating meals. */
export async function copyDayAction(fromDate: string, toDate: string, onlySlot?: string): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !date.safeParse(fromDate).success || !date.safeParse(toDate).success) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  let q = supabase.from("food_log_entries").select("meal_slot, food_id, name, quantity_g, kcal, protein_g, carbs_g, fat_g").eq("client_id", v.client.id).eq("logged_on", fromDate);
  if (onlySlot && slot.safeParse(onlySlot).success) q = q.eq("meal_slot", onlySlot);
  const { data, error } = await q;
  if (error) return dbError(error, "copy day read");
  if (!data?.length) return fail(t.foodLog.nothingToCopy);
  const { error: insErr } = await supabase.from("food_log_entries").insert(data.map((r) => ({ ...r, client_id: v.client.id, logged_on: toDate })));
  if (insErr) return dbError(insErr, "copy day");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

export async function setWaterAction(day: string, ml: number): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !date.safeParse(day).success || !(ml >= 0 && ml <= 10000)) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { error } = await supabase.from("water_logs").upsert({ client_id: v.client.id, logged_on: day, ml: Math.round(ml), updated_at: new Date().toISOString() });
  if (error) return dbError(error, "water");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}
