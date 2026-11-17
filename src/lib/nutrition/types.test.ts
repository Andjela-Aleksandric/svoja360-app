import { describe, expect, it } from "vitest";
import { dayMacros, mealMacros, type Food } from "./types";

const foods = new Map<string, Food>([
  ["oat", { id: "oat", name: "Ovsene", brand: null, serving_size_g: null, kcal_100g: 379, protein_100g: 13, carbs_100g: 68, fat_100g: 6.5, fiber_100g: 10, source: null, is_custom: false, is_archived: false }],
  ["yog", { id: "yog", name: "Jogurt", brand: null, serving_size_g: null, kcal_100g: 60, protein_100g: 10, carbs_100g: 4, fat_100g: 0.4, fiber_100g: 0, source: null, is_custom: false, is_archived: false }],
]);

describe("nutrition totals", () => {
  const meal = { items: [
    { id: "a", food_id: "oat", quantity_g: 50, alternative_to: null, position: 0, notes: null },
    { id: "b", food_id: "yog", quantity_g: 200, alternative_to: null, position: 1, notes: null },
    { id: "c", food_id: "oat", quantity_g: 80, alternative_to: "a", position: 2, notes: null },
  ] };
  it("ignores alternatives in totals", () => {
    const m = mealMacros(meal, foods);
    expect(Math.round(m.kcal)).toBe(190 + 120);
    expect(Math.round(m.protein)).toBe(27);
  });
  it("sums meals into a day", () => {
    const d = dayMacros({ id: "d", position: 0, name: "", notes: null, meals: [{ id: "m", position: 0, name: "", meal_time: null, instructions: null, ...meal }, { id: "m2", position: 1, name: "", meal_time: null, instructions: null, items: [] }] }, foods);
    expect(Math.round(d.carbs)).toBe(42);
  });
});
