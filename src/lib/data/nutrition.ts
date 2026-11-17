import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { num } from "./clients";
import type { Food, MealTemplate, NutritionTree } from "@/lib/nutrition/types";

export const listFoods = cache(async (includeArchived = false): Promise<Food[]> => {
  const supabase = await createClient();
  let q = supabase.from("foods").select("id, name, brand, serving_size_g, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, source, is_custom, is_archived").order("name");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data } = await q;
  return ((data ?? []) as Food[]).map((f) => ({ ...f, serving_size_g: num(f.serving_size_g), kcal_100g: num(f.kcal_100g)!, protein_100g: num(f.protein_100g)!, carbs_100g: num(f.carbs_100g)!, fat_100g: num(f.fat_100g)!, fiber_100g: num(f.fiber_100g) }));
});

export async function getNutritionTree(id: string): Promise<NutritionTree | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: p }, { data: days }, { data: meals }, { data: items }] = await Promise.all([
    supabase.from("nutrition_plans").select("id, client_id, name, kcal_target, protein_g, carbs_g, fat_g, notes, status, start_date").eq("id", id).maybeSingle(),
    supabase.from("nutrition_plan_days").select("id, position, name, notes").eq("plan_id", id).order("position"),
    supabase.from("meals").select("id, plan_day_id, position, name, meal_time, instructions").eq("plan_id", id).order("position"),
    supabase.from("meal_items").select("id, meal_id, food_id, quantity_g, alternative_to, position, notes").eq("plan_id", id).order("position"),
  ]);
  if (!p) return null;
  return {
    ...(p as Omit<NutritionTree, "days">),
    days: (days ?? []).map((d) => ({
      ...(d as { id: string; position: number; name: string; notes: string | null }),
      meals: (meals ?? []).filter((m) => m.plan_day_id === d.id).map((m) => ({
        id: m.id, position: m.position, name: m.name, meal_time: (m.meal_time as string | null)?.slice(0, 5) ?? null, instructions: m.instructions,
        items: (items ?? []).filter((i) => i.meal_id === m.id).map((i) => ({ id: i.id, food_id: i.food_id, quantity_g: num(i.quantity_g)!, alternative_to: i.alternative_to, position: i.position, notes: i.notes })),
      })),
    })),
  } as NutritionTree;
}

export async function listMealTemplates(): Promise<MealTemplate[]> {
  const supabase = await createClient();
  const { data: meals } = await supabase.from("meals").select("id, name, meal_time, instructions").eq("is_template", true).order("name");
  if (!meals?.length) return [];
  const { data: items } = await supabase.from("meal_items").select("id, meal_id, food_id, quantity_g, alternative_to, position, notes").in("meal_id", meals.map((m) => m.id)).order("position");
  return meals.map((m) => ({ id: m.id, name: m.name, meal_time: (m.meal_time as string | null)?.slice(0, 5) ?? null, instructions: m.instructions,
    items: (items ?? []).filter((i) => i.meal_id === m.id).map((i) => ({ id: i.id, food_id: i.food_id, quantity_g: num(i.quantity_g)!, alternative_to: i.alternative_to, position: i.position, notes: i.notes })) }));
}

export async function getActivePlanId(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("nutrition_plans").select("id").eq("client_id", clientId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string) ?? null;
}
