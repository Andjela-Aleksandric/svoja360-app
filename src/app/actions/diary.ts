"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { isoWeekday, todayISO } from "@/lib/utils/format";

const uuid = z.string().uuid();

async function ownDay(dayId: string) {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(dayId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("nutrition_diary_days").select("id, client_id, diary_date, submitted_at").eq("id", dayId).maybeSingle();
  return data && data.client_id === v.client.id ? { supabase, day: data } : null;
}

export async function saveDiaryDayAction(dayIndex: number, date: string, notes: string): Promise<ActionResult<{ id: string }>> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  if (![1, 2, 3].includes(dayIndex)) return fail();
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO())) return fail(t.validation.date, { diary_date: t.validation.date });
  const supabase = await createClient();
  const { data, error } = await supabase.from("nutrition_diary_days").upsert({
    client_id: v.client.id, day_index: dayIndex, diary_date: date || null,
    day_type: date ? (isoWeekday(date) >= 6 ? "weekend" : "weekday") : null,
    notes: notes.trim().slice(0, 2000) || null,
  }, { onConflict: "client_id,day_index" }).select("id").single();
  if (error) return dbError(error, "diary day");
  revalidatePath("/klijent", "layout");
  return { ok: true, data: { id: data.id as string } };
}

const itemSchema = z.object({
  eaten_at: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
  food_name: z.string().trim().min(1, t.validation.required).max(200),
  quantity: z.string().trim().max(100),
  is_drink: z.boolean(),
  notes: z.string().trim().max(500),
});

export async function addDiaryItemAction(dayId: string, input: z.input<typeof itemSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await ownDay(dayId);
  if (!ctx) return fail(t.errors.forbidden);
  const p = itemSchema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed, { [String(p.error.issues[0].path[0])]: p.error.issues[0].message });
  const { data, error } = await ctx.supabase.from("nutrition_diary_items").insert({
    day_id: dayId, eaten_at: p.data.eaten_at || null, food_name: p.data.food_name, quantity: p.data.quantity || null, is_drink: p.data.is_drink, notes: p.data.notes || null,
  }).select("id").single();
  if (error) return dbError(error, "diary item");
  revalidatePath("/klijent/dnevnik-ishrane");
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteDiaryItemAction(itemId: string): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(itemId).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { error } = await supabase.from("nutrition_diary_items").delete().eq("id", itemId);
  if (error) return dbError(error, "delete diary item");
  revalidatePath("/klijent/dnevnik-ishrane");
  return { ok: true };
}

export async function setDiaryDayDoneAction(dayId: string, done: boolean): Promise<ActionResult> {
  const ctx = await ownDay(dayId);
  if (!ctx) return fail(t.errors.forbidden);
  if (done) {
    const { count } = await ctx.supabase.from("nutrition_diary_items").select("id", { count: "exact", head: true }).eq("day_id", dayId);
    if (!ctx.day.diary_date) return fail(t.diary.needDate);
    if (!count) return fail(t.diary.needItems);
  }
  const { error } = await ctx.supabase.from("nutrition_diary_days").update({ submitted_at: done ? new Date().toISOString() : null }).eq("id", dayId);
  if (error) return dbError(error, "diary done");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}
