export interface FoodMacros {
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g?: number | null;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export const EMPTY_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function macrosFor(food: FoodMacros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: Number(food.kcal_100g) * f,
    protein: Number(food.protein_100g) * f,
    carbs: Number(food.carbs_100g) * f,
    fat: Number(food.fat_100g) * f,
    fiber: Number(food.fiber_100g ?? 0) * f,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, fiber: a.fiber + b.fiber }),
    { ...EMPTY_MACROS },
  );
}

/** Energy from macros (4/4/9). Useful for checking targets against the calorie goal. */
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return Math.round(protein * 4 + carbs * 4 + fat * 9);
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat), fiber: Math.round(m.fiber) };
}
