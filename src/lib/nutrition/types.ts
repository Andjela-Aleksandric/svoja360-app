import { macrosFor, sumMacros, type Macros } from "@/lib/utils/nutrition";

export interface Food { id: string; name: string; brand: string | null; serving_size_g: number | null; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; fiber_100g: number | null; source: string | null; is_custom: boolean; is_archived: boolean }
export interface NItem { id: string; food_id: string; quantity_g: number; alternative_to: string | null; position: number; notes: string | null }
export interface NMeal { id: string; position: number; name: string; meal_time: string | null; instructions: string | null; items: NItem[] }
export interface NDay { id: string; position: number; name: string; notes: string | null; meals: NMeal[] }
export interface NutritionTree {
  id: string; client_id: string | null; name: string; kcal_target: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
  notes: string | null; status: "draft" | "active" | "completed" | "archived"; start_date: string | null; days: NDay[];
}
export interface MealTemplate { id: string; name: string; meal_time: string | null; instructions: string | null; items: NItem[] }

/** Totals count only main items; alternatives are swaps, not extra food. */
export function mealMacros(meal: { items: NItem[] }, foods: Map<string, Food>): Macros {
  return sumMacros(meal.items.filter((i) => !i.alternative_to).map((i) => { const f = foods.get(i.food_id); return f ? macrosFor(f, i.quantity_g) : macrosFor({ kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fat_100g: 0 }, 0); }));
}
export function dayMacros(day: NDay, foods: Map<string, Food>): Macros {
  return sumMacros(day.meals.map((m) => mealMacros(m, foods)));
}
