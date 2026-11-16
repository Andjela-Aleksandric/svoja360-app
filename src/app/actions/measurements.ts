"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { parseDecimal, todayISO } from "@/lib/utils/format";

const uuid = z.string().uuid();

const measurementFields = ["weight_kg", "waist_cm", "hips_cm", "chest_cm", "thigh_cm", "arm_cm", "body_fat_pct"] as const;
const measurementRanges: Record<(typeof measurementFields)[number], [number, number]> = {
  weight_kg: [25, 300], waist_cm: [30, 250], hips_cm: [30, 250], chest_cm: [30, 250], thigh_cm: [20, 150], arm_cm: [10, 80], body_fat_pct: [3, 70],
};

/** Shared by coach and client forms; RLS decides who may write for which client. */
export async function saveMeasurementAction(_: unknown, fd: FormData): Promise<ActionResult> {
  if (!(await getViewer())) return fail(t.errors.forbidden);
  const clientId = uuid.safeParse(fd.get("client_id"));
  const date = String(fd.get("measured_on") ?? "");
  if (!clientId.success) return fail();
  const fieldErrors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) fieldErrors.measured_on = t.validation.date;
  const row: Record<string, unknown> = { client_id: clientId.data, measured_on: date, source: "manual", notes: String(fd.get("notes") ?? "").trim().slice(0, 1000) || null };
  let any = false;
  for (const f of measurementFields) {
    const raw = fd.get(f);
    if (raw === null || raw === "") { row[f] = null; continue; }
    const v = parseDecimal(raw);
    const [min, max] = measurementRanges[f];
    if (v === null || v < min || v > max) fieldErrors[f] = t.validation.range(min, max);
    else { row[f] = v; any = true; }
  }
  if (!any && !Object.keys(fieldErrors).length) fieldErrors.weight_kg = t.measurements.atLeastOne;
  if (Object.keys(fieldErrors).length) return fail(t.errors.saveFailed, fieldErrors);
  const supabase = await createClient();
  const id = fd.get("id");
  const q = typeof id === "string" && uuid.safeParse(id).success
    ? supabase.from("body_measurements").update(row).eq("id", id)
    : supabase.from("body_measurements").insert(row);
  const { error } = await q;
  if (error) return dbError(error, "save measurement");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteMeasurementAction(id: string): Promise<ActionResult> {
  if (!(await getViewer())) return fail(t.errors.forbidden);
  if (!uuid.safeParse(id).success) return fail();
  const supabase = await createClient();
  const { error } = await supabase.from("body_measurements").delete().eq("id", id);
  if (error) return dbError(error, "delete measurement");
  revalidatePath("/", "layout");
  return { ok: true };
}
