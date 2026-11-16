"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { normalizePhone } from "@/lib/utils/phone";
import { parseDecimal, todayISO } from "@/lib/utils/format";

const uuid = z.string().uuid();

const clientSchema = z.object({
  full_name: z.string().trim().min(2, t.validation.minLength(2)).max(120, t.validation.maxLength(120)),
  email: z.string().trim().toLowerCase().email(t.validation.email),
  phone: z.string().trim().max(40).optional().default(""),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.validation.date).or(z.literal("")).optional().default(""),
  height_cm: z.string().optional().default(""),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.validation.date),
  goal: z.string().trim().max(500).optional().default(""),
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

function parseClientForm(fd: FormData) {
  const parsed = clientSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: fail(t.errors.saveFailed, fieldErrors) } as const;
  }
  const v = parsed.data;
  const fieldErrors: Record<string, string> = {};
  const phone_e164 = v.phone ? normalizePhone(v.phone) : null;
  if (v.phone && !phone_e164) fieldErrors.phone = t.validation.phone;
  const height = v.height_cm ? parseDecimal(v.height_cm) : null;
  if (v.height_cm && (height === null || height < 100 || height > 250)) fieldErrors.height_cm = t.validation.range(100, 250);
  if (v.birth_date && (v.birth_date > todayISO() || v.birth_date < "1900-01-01")) fieldErrors.birth_date = t.validation.date;
  if (Object.keys(fieldErrors).length) return { error: fail(t.errors.saveFailed, fieldErrors) } as const;
  return {
    values: {
      full_name: v.full_name,
      email: v.email,
      phone: v.phone || null,
      phone_e164,
      birth_date: v.birth_date || null,
      height_cm: height,
      start_date: v.start_date,
      goal: v.goal || null,
      ...(v.status ? { status: v.status } : {}),
    },
  } as const;
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function sendInvite(email: string, fullName: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl()}/nova-lozinka`,
  });
  if (error) console.error("[invite]", error.status, error.message);
  return !error;
}

export async function createClientAction(_: unknown, fd: FormData): Promise<ActionResult<{ id: string; inviteFailed: boolean }>> {
  await assertCoach();
  const parsed = parseClientForm(fd);
  if ("error" in parsed) return parsed.error!;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(parsed.values).select("id").single();
  if (error) {
    if (error.code === "23505") return fail(t.errors.emailTaken, { email: t.errors.emailTaken });
    return dbError(error, "create client");
  }
  let inviteFailed = false;
  if (fd.get("send_invite") === "on") inviteFailed = !(await sendInvite(parsed.values.email, parsed.values.full_name));
  revalidatePath("/trener", "layout");
  return { ok: true, data: { id: data.id as string, inviteFailed } };
}

export async function updateClientAction(_: unknown, fd: FormData): Promise<ActionResult> {
  await assertCoach();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return fail();
  const parsed = parseClientForm(fd);
  if ("error" in parsed) return parsed.error!;
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.values).eq("id", id.data);
  if (error) {
    if (error.code === "23505") return fail(t.errors.emailTaken, { email: t.errors.emailTaken });
    return dbError(error, "update client");
  }
  revalidatePath("/trener", "layout");
  return { ok: true };
}

export async function resendInviteAction(clientId: string): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(clientId).success) return fail();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("email, full_name, user_id").eq("id", clientId).maybeSingle();
  if (!data) return fail(t.errors.notFound);
  const admin = createAdminClient();
  if (!admin) return fail(t.errors.missingServiceKey);
  if (data.user_id) {
    // Already has an account: send a password link instead of a new invite.
    const { error } = await admin.auth.resetPasswordForEmail(data.email, { redirectTo: `${siteUrl()}/nova-lozinka` });
    if (error) return fail(t.errors.inviteFailed);
  } else if (!(await sendInvite(data.email, data.full_name))) {
    return fail(t.errors.inviteFailed);
  }
  revalidatePath(`/trener/klijenti/${clientId}`);
  return { ok: true };
}

export async function setClientStatusAction(clientId: string, status: "active" | "inactive" | "archived"): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(clientId).success || !["active", "inactive", "archived"].includes(status)) return fail();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status, archived_at: status === "archived" ? new Date().toISOString() : null })
    .eq("id", clientId);
  if (error) return dbError(error, "client status");
  revalidatePath("/trener", "layout");
  return { ok: true };
}

/** Permanently removes a client: storage files, auth account and every row (cascade). */
export async function deleteClientAction(clientId: string, confirmName: string): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(clientId).success) return fail();
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, full_name, user_id").eq("id", clientId).maybeSingle();
  if (!client) return fail(t.errors.notFound);
  if (confirmName.trim().toLowerCase() !== String(client.full_name).trim().toLowerCase()) return fail(t.clients.deleteTypeName);
  const admin = createAdminClient();
  if (!admin) return fail(t.errors.missingServiceKey);

  // 1. Files in storage (every object lives under "<client_id>/...").
  const { data: files } = await admin.from("client_files").select("storage_path").eq("client_id", clientId);
  const paths = (files ?? []).map((f) => f.storage_path as string);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from("client-files").remove(paths.slice(i, i + 100));
    if (error) return dbError({ message: error.message }, "delete client files");
  }
  // 2. Database rows (cascades to everything that belongs to the client).
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return dbError(error, "delete client");
  // 3. Login account.
  if (client.user_id) {
    const { error: authErr } = await admin.auth.admin.deleteUser(client.user_id as string);
    if (authErr) console.error("[delete auth user]", authErr.message);
  }
  revalidatePath("/trener", "layout");
  return { ok: true };
}

const noteSchema = z.object({ client_id: uuid, body: z.string().trim().min(1, t.validation.required).max(5000, t.validation.maxLength(5000)) });

export async function addNoteAction(_: unknown, fd: FormData): Promise<ActionResult> {
  await assertCoach();
  const parsed = noteSchema.safeParse({ client_id: fd.get("client_id"), body: fd.get("body") });
  if (!parsed.success) return fail(t.validation.required, { body: parsed.error.issues[0]?.message ?? t.validation.required });
  const submission = fd.get("submission_id");
  const supabase = await createClient();
  const { error } = await supabase.from("coach_notes").insert({
    ...parsed.data,
    submission_id: typeof submission === "string" && uuid.safeParse(submission).success ? submission : null,
  });
  if (error) return dbError(error, "add note");
  revalidatePath(`/trener/klijenti/${parsed.data.client_id}`);
  return { ok: true };
}

export async function toggleNotePinAction(noteId: string, pinned: boolean): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(noteId).success) return fail();
  const supabase = await createClient();
  const { data, error } = await supabase.from("coach_notes").update({ is_pinned: pinned }).eq("id", noteId).select("client_id").single();
  if (error) return dbError(error, "pin note");
  revalidatePath(`/trener/klijenti/${data.client_id}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  await assertCoach();
  if (!uuid.safeParse(noteId).success) return fail();
  const supabase = await createClient();
  const { data, error } = await supabase.from("coach_notes").delete().eq("id", noteId).select("client_id").single();
  if (error) return dbError(error, "delete note");
  revalidatePath(`/trener/klijenti/${data.client_id}`);
  return { ok: true };
}

