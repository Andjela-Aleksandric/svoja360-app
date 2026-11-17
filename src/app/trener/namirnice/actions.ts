"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const n = (max: number) => z.number().min(0).max(max);
const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, t.validation.minLength(2)).max(120),
  brand: z.string().trim().max(80).nullable(),
  serving_size_g: z.number().gt(0).max(3000).nullable(),
  kcal_100g: n(900), protein_100g: n(100), carbs_100g: n(100), fat_100g: n(100), fiber_100g: n(100).nullable(),
}).refine((f) => f.protein_100g + f.carbs_100g + f.fat_100g <= 100.5, { message: "macros", path: ["fat_100g"] });

export async function saveFoodAction(input: z.input<typeof schema>): Promise<ActionResult> {
  await assertCoach();
  const p = schema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message === "macros" ? t.foods.macrosTooHigh : i.message])));
  const { id, ...row } = p.data;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("foods").update(row).eq("id", id) : await supabase.from("foods").insert({ ...row, is_custom: true, source: "Prilagođena" });
  if (error) return dbError(error, "save food");
  revalidatePath("/trener", "layout");
  return { ok: true };
}

export async function archiveFoodAction(id: string, archived: boolean): Promise<ActionResult> {
  await assertCoach();
  if (!z.string().uuid().safeParse(id).success) return fail();
  const supabase = await createClient();
  const { error } = await supabase.from("foods").update({ is_archived: archived }).eq("id", id);
  if (error) return dbError(error, "archive food");
  revalidatePath("/trener", "layout");
  return { ok: true };
}
