"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";

const uuid = z.string().uuid();
const ni = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const schema = z.object({
  id: uuid.optional(),
  client_id: uuid.optional(),
  workout_id: uuid.nullable(),
  performed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.string().datetime({ offset: true }).nullable(),
  distance_m: z.number().int().min(1).max(400000),
  duration_s: z.number().int().min(1).max(172800),
  avg_hr: ni(40, 230), max_hr: ni(40, 240), avg_power: ni(0, 1000), elevation_gain_m: ni(0, 20000),
  source: z.enum(["manual", "gpx", "fit"]),
  file_id: uuid.nullable(),
  title: z.string().trim().max(120).nullable(),
  notes: z.string().max(2000).nullable(),
  rpe: ni(1, 10),
});
export type ActivityInput = z.infer<typeof schema>;

/** Clients log their own runs; coaches may add one for a client (client_id required). */
export async function saveActivityAction(input: ActivityInput): Promise<ActionResult<{ id: string }>> {
  const v = await getViewer();
  if (!v) return fail(t.errors.forbidden);
  const p = schema.safeParse(input);
  if (!p.success) return fail(t.errors.saveFailed, Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])));
  if (p.data.performed_on > todayISO()) return fail(t.validation.date, { performed_on: t.validation.date });
  const clientId = v.role === "client" ? v.client?.id : p.data.client_id;
  if (!clientId) return fail(t.errors.forbidden);
  const { id, ...row } = p.data;
  const supabase = await createClient();
  const q = id ? supabase.from("running_activities").update({ ...row, client_id: clientId }).eq("id", id).select("id").single()
    : supabase.from("running_activities").insert({ ...row, client_id: clientId }).select("id").single();
  const { data, error } = await q;
  if (error) return dbError(error, "save activity");
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteActivityAction(id: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!v || !uuid.safeParse(id).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { error } = await supabase.from("running_activities").delete().eq("id", id);
  if (error) return dbError(error, "delete activity");
  revalidatePath("/", "layout");
  return { ok: true };
}
