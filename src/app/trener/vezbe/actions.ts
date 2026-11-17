"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, t.validation.minLength(2)).max(120),
  equipment: z.enum(["barbell", "dumbbell", "kettlebell", "machine", "cable", "bodyweight", "band", "smith", "trap_bar", "ez_bar", "bench", "other"]),
  exercise_type: z.enum(["compound", "isolation", "plyometric", "core", "mobility", "cardio"]),
  movement_pattern: z.enum(["squat", "hinge", "lunge", "push_horizontal", "push_vertical", "pull_horizontal", "pull_vertical", "carry", "core", "isolation", "other"]),
  instructions: z.string().max(3000).nullable(),
  media_url: z.string().regex(/^https:\/\/\S+$/, t.exercises.mediaHelp).max(500).nullable(),
  parent_id: z.string().uuid().nullable(),
  primary: z.number().int().positive(),
  secondary: z.array(z.number().int().positive()).max(10),
});
export type ExerciseInput = z.input<typeof schema>;

export async function saveExerciseAction(input: ExerciseInput): Promise<ActionResult<{ id: string }>> {
  await assertCoach();
  const p = schema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
  const { primary, secondary, id, ...row } = p.data;
  const supabase = await createClient();
  let exId = id;
  if (id) {
    const { error } = await supabase.from("exercises").update(row).eq("id", id);
    if (error) return dbError(error, "update exercise");
    await supabase.from("exercise_muscles").delete().eq("exercise_id", id);
  } else {
    const { data, error } = await supabase.from("exercises").insert({ ...row, is_custom: true }).select("id").single();
    if (error) return dbError(error, "create exercise");
    exId = data.id as string;
  }
  const muscles = [{ exercise_id: exId, muscle_group_id: primary, is_primary: true }, ...secondary.filter((m) => m !== primary).map((m) => ({ exercise_id: exId, muscle_group_id: m, is_primary: false }))];
  const { error: mErr } = await supabase.from("exercise_muscles").insert(muscles);
  if (mErr) return dbError(mErr, "exercise muscles");
  revalidatePath("/trener", "layout");
  return { ok: true, data: { id: exId! } };
}

export async function archiveExerciseAction(id: string, archived: boolean): Promise<ActionResult> {
  await assertCoach();
  if (!z.string().uuid().safeParse(id).success) return fail();
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update({ is_archived: archived }).eq("id", id);
  if (error) return dbError(error, "archive exercise");
  revalidatePath("/trener", "layout");
  return { ok: true };
}
