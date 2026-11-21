import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/utils/format";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export interface FoodEntry { id: string; logged_on: string; meal_slot: MealSlot; food_id: string | null; name: string; quantity_g: number | null; kcal: number; protein_g: number; carbs_g: number; fat_g: number; created_at: string }
export interface DayTotals { date: string; kcal: number; protein: number; carbs: number; fat: number; water: number; entries: number }

const n = (v: unknown) => (v == null ? 0 : Number(v));
const toEntry = (r: Record<string, unknown>): FoodEntry => ({
  id: r.id as string, logged_on: r.logged_on as string, meal_slot: r.meal_slot as MealSlot, food_id: (r.food_id as string) ?? null, name: r.name as string,
  quantity_g: r.quantity_g == null ? null : Number(r.quantity_g), kcal: n(r.kcal), protein_g: n(r.protein_g), carbs_g: n(r.carbs_g), fat_g: n(r.fat_g), created_at: r.created_at as string,
});

/** One day of the food diary: entries, water, and the food ids the client logs most often (for "Nedavno"). */
export async function getFoodDay(clientId: string, date: string) {
  const supabase = await createClient();
  const [entries, water, recent] = await Promise.all([
    supabase.from("food_log_entries").select("*").eq("client_id", clientId).eq("logged_on", date).order("created_at"),
    supabase.from("water_logs").select("ml").eq("client_id", clientId).eq("logged_on", date).maybeSingle(),
    supabase.from("food_log_entries").select("food_id, quantity_g").eq("client_id", clientId).not("food_id", "is", null).order("created_at", { ascending: false }).limit(150),
  ]);
  const seen = new Map<string, number>();
  for (const r of recent.data ?? []) if (!seen.has(r.food_id as string)) seen.set(r.food_id as string, Number(r.quantity_g ?? 100));
  return {
    entries: (entries.data ?? []).map(toEntry),
    water: Number(water.data?.ml ?? 0),
    recent: [...seen.entries()].slice(0, 25).map(([food_id, grams]) => ({ food_id, grams })),
    ready: !entries.error,
  };
}

/** Daily totals for a date range (inclusive), oldest first. Used by the coach and the weekly view. */
export async function getFoodTotals(clientId: string, from: string, to: string): Promise<DayTotals[]> {
  const supabase = await createClient();
  const [entries, water] = await Promise.all([
    supabase.from("food_log_entries").select("logged_on, kcal, protein_g, carbs_g, fat_g").eq("client_id", clientId).gte("logged_on", from).lte("logged_on", to),
    supabase.from("water_logs").select("logged_on, ml").eq("client_id", clientId).gte("logged_on", from).lte("logged_on", to),
  ]);
  const out: DayTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const es = (entries.data ?? []).filter((e) => e.logged_on === d);
    out.push({
      date: d, entries: es.length,
      kcal: Math.round(es.reduce((a, e) => a + n(e.kcal), 0)), protein: Math.round(es.reduce((a, e) => a + n(e.protein_g), 0)),
      carbs: Math.round(es.reduce((a, e) => a + n(e.carbs_g), 0)), fat: Math.round(es.reduce((a, e) => a + n(e.fat_g), 0)),
      water: Number((water.data ?? []).find((w) => w.logged_on === d)?.ml ?? 0),
    });
  }
  return out;
}
