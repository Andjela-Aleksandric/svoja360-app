"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";

const uuid = z.string().uuid();
const nn = (min: number, max: number) => z.number().min(min).max(max).nullable();
const workoutSchema = z.object({
  id: uuid,
  program_id: uuid.nullable(),
  training_day_id: uuid.nullable(),
  name: z.string().trim().min(1).max(120),
  performed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.string().datetime({ offset: true }).nullable(),
  finished_at: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(["in_progress", "completed"]),
  notes: z.string().max(2000).nullable(),
  device_updated_at: z.string().datetime({ offset: true }),
  sets: z.array(z.object({
    exercise_id: uuid, prescription_set_id: uuid.nullable(), exercise_position: z.number().int().min(0).max(100), position: z.number().int().min(0).max(100),
    set_type: z.enum(["warmup", "working", "dropset"]), reps: nn(0, 200), weight_kg: nn(0, 500), rir: nn(0, 10),
    is_completed: z.boolean(), is_skipped: z.boolean(), notes: z.string().max(500).nullable(), completed_at: z.string().datetime({ offset: true }).nullable(),
  })).max(400),
});
export type WorkoutPayload = z.infer<typeof workoutSchema>;

/** Saves a workout. Safe to call repeatedly with the same payload (offline retries). */
export async function logWorkoutAction(payload: WorkoutPayload): Promise<ActionResult<{ id: string }>> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const p = workoutSchema.safeParse(payload);
  if (!p.success) { console.error("[workout validate]", p.error.issues.slice(0, 3)); return fail(t.errors.saveFailed); }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_workout", { p: p.data });
  if (error) return dbError(error, "log workout");
  revalidatePath("/klijent", "layout");
  return { ok: true, data: { id: data as string } };
}

export async function deleteWorkoutAction(id: string): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(id).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sessions").delete().eq("id", id).eq("client_id", v.client.id);
  if (error) return dbError(error, "delete workout");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}
