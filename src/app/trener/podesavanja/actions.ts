"use server";
import { revalidatePath } from "next/cache";
import { assertCoach, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { normalizePhone } from "@/lib/utils/phone";

export async function saveDeadlineAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const v = await assertCoach().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const weekday = Number(fd.get("weekday"));
  const hour = Number(fd.get("hour"));
  if (!(weekday >= 1 && weekday <= 7) || !(hour >= 0 && hour <= 23)) return fail(t.errors.saveFailed);
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "checkin_deadline", value: { weekday, hour }, updated_by: v.userId }, { onConflict: "key" });
  if (error) return dbError(error, "deadline");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Coaches and clients may edit their own name and phone (column grants restrict the rest). */
export async function saveProfileAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return fail(t.errors.forbidden);
  const full_name = String(fd.get("full_name") ?? "").trim().slice(0, 120);
  const rawPhone = String(fd.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (full_name.length < 2) return fail(t.errors.saveFailed, { full_name: t.validation.minLength(2) });
  if (rawPhone && !phone) return fail(t.errors.saveFailed, { phone: t.validation.phone });
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name, phone }).eq("id", v.userId);
  if (error) return dbError(error, "profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
