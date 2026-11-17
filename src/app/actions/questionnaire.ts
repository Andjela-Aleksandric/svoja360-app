"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClient, getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, dbError, fail } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { getSubmission, getTemplate, getTemplateById } from "@/lib/data/questionnaire";
import { byCode, isEmpty, isVisible, validateSections, validateValue, type Answers, type Template } from "@/lib/questionnaire/logic";
import { previousWeek } from "@/lib/utils/periods";
import { todayISO } from "@/lib/utils/format";

const uuid = z.string().uuid();
const CONSENTS = ["health_data", "photos_videos", "documents"] as const;

export async function setConsentAction(type: (typeof CONSENTS)[number], granted: boolean): Promise<ActionResult> {
  const v = await assertClient().catch(() => null);
  if (!v || !CONSENTS.includes(type)) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { error } = await supabase.from("client_consents").upsert(
    { client_id: v.client.id, consent_type: type, granted: !!granted, decided_at: new Date().toISOString() },
    { onConflict: "client_id,consent_type" },
  );
  if (error) return dbError(error, "consent");
  revalidatePath("/klijent", "layout");
  return { ok: true };
}

/** Opens the client's initial questionnaire draft. A submitted one is copied into a new version. */
export async function startInitialAction(): Promise<ActionResult<{ id: string }>> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const template = await getTemplate("initial");
  if (!template) return fail();
  const { data: existing } = await supabase.from("questionnaire_submissions").select("id, status").eq("client_id", v.client.id).eq("kind", "initial").order("created_at", { ascending: false });
  const draft = existing?.find((s) => s.status === "draft");
  if (draft) return { ok: true, data: { id: draft.id as string } };
  const { data: created, error } = await supabase.from("questionnaire_submissions")
    .insert({ client_id: v.client.id, template_id: template.id, kind: "initial", status: "draft" }).select("id").single();
  if (error) return dbError(error, "start initial");
  const last = existing?.[0];
  if (last) {
    const { data: prev } = await supabase.from("questionnaire_answers").select("question_id, value").eq("submission_id", last.id);
    if (prev?.length) await supabase.from("questionnaire_answers").insert(prev.map((a) => ({ ...a, submission_id: created.id })));
    // Answers the client may no longer write (e.g. consent withdrawn) are skipped by RLS and simply stay empty.
  }
  return { ok: true, data: { id: created.id as string } };
}

/** Opens (or creates) the check-in for the previous Monday–Sunday week. */
export async function startCheckinAction(): Promise<ActionResult<{ id: string }>> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const template = await getTemplate("checkin");
  if (!template) return fail();
  const p = previousWeek();
  const { data: existing } = await supabase.from("questionnaire_submissions").select("id").eq("client_id", v.client.id).eq("kind", "checkin").eq("period_start", p.start).maybeSingle();
  if (existing) return { ok: true, data: { id: existing.id as string } };
  const { data, error } = await supabase.from("questionnaire_submissions")
    .insert({ client_id: v.client.id, template_id: template.id, kind: "checkin", status: "draft", period_start: p.start, period_end: p.end }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase.from("questionnaire_submissions").select("id").eq("client_id", v.client.id).eq("kind", "checkin").eq("period_start", p.start).maybeSingle();
      if (again) return { ok: true, data: { id: again.id as string } };
    }
    return dbError(error, "start checkin");
  }
  return { ok: true, data: { id: data.id as string } };
}

async function loadOwnSubmission(submissionId: string) {
  const v = await assertClient().catch(() => null);
  if (!v || !uuid.safeParse(submissionId).success) return null;
  const sub = await getSubmission(submissionId);
  if (!sub || sub.client_id !== v.client.id) return null;
  const template = await getTemplateById(sub.template_id);
  if (!template) return null;
  return { viewer: v, sub, template };
}

function errorText(e: ReturnType<typeof validateValue>): string {
  if (!e) return "";
  if (e.code === "required") return t.validation.required;
  if (e.code === "range") return t.validation.range(e.min ?? 0, e.max ?? 0);
  if (e.code === "email") return t.validation.email;
  if (e.code === "date") return t.validation.date;
  if (e.code === "number") return t.validation.number;
  return t.errors.saveFailed;
}

/** Saves the answers of one step. Only questions of this template are accepted; empty answers are removed. */
export async function saveAnswersAction(submissionId: string, answers: Answers, step: number): Promise<ActionResult> {
  const ctx = await loadOwnSubmission(submissionId);
  if (!ctx) return fail(t.errors.forbidden);
  if (ctx.sub.status === "reviewed") return fail(t.errors.forbidden);
  const questions = new Map(ctx.template.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
  const upserts: { submission_id: string; question_id: string; value: unknown }[] = [];
  const deletes: string[] = [];
  const fieldErrors: Record<string, string> = {};
  for (const [qid, value] of Object.entries(answers ?? {})) {
    const q = questions.get(qid);
    if (!q) continue;
    if (isEmpty(value)) { deletes.push(qid); continue; }
    const e = validateValue({ ...q, required: false }, value);
    if (e) { fieldErrors[qid] = errorText(e); continue; }
    upserts.push({ submission_id: submissionId, question_id: qid, value: typeof value === "string" ? value.trim() : value });
  }
  if (Object.keys(fieldErrors).length) return fail(t.errors.saveFailed, fieldErrors);
  const supabase = await createClient();
  if (upserts.length) {
    const { error } = await supabase.from("questionnaire_answers").upsert(upserts, { onConflict: "submission_id,question_id" });
    if (error) return error.code === "42501" ? fail(t.errors.consentRequired) : dbError(error, "save answers");
  }
  if (deletes.length) await supabase.from("questionnaire_answers").delete().eq("submission_id", submissionId).in("question_id", deletes);
  if (Number.isInteger(step) && step >= 0 && step <= 20 && ctx.sub.status === "draft") {
    await supabase.from("questionnaire_submissions").update({ current_step: step }).eq("id", submissionId);
  }
  return { ok: true };
}

export async function submitSubmissionAction(submissionId: string): Promise<ActionResult> {
  const ctx = await loadOwnSubmission(submissionId);
  if (!ctx) return fail(t.errors.forbidden);
  if (ctx.sub.status === "reviewed") return fail(t.errors.forbidden);
  const { template, sub } = ctx;
  const codes = byCode(template);
  const errors = validateSections(template.sections, sub.answers, codes);
  if (Object.keys(errors).length) {
    return fail(t.questionnaire.missingCount(Object.keys(errors).length), Object.fromEntries(Object.entries(errors).map(([k, e]) => [k, errorText(e)])));
  }
  const supabase = await createClient();
  // Remove answers to questions that are hidden now (e.g. pain details after answering "No").
  const hidden = template.sections.flatMap((s) => s.questions).filter((q) => !isVisible(q, sub.answers, codes) && sub.answers[q.id] !== undefined).map((q) => q.id);
  if (hidden.length) await supabase.from("questionnaire_answers").delete().eq("submission_id", submissionId).in("question_id", hidden);

  if (sub.status === "draft") {
    const { error } = await supabase.from("questionnaire_submissions").update({ status: "submitted" }).eq("id", submissionId);
    if (error) return dbError(error, "submit");
  } else {
    await supabase.from("questionnaire_submissions").update({ updated_at: new Date().toISOString() }).eq("id", submissionId);
  }
  await syncMeasurement(template, sub.answers, submissionId, sub.client_id, sub.kind === "checkin" ? sub.period_end ?? todayISO() : todayISO(), sub.kind);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Weight and body measurements from a questionnaire also go into body_measurements, so charts have one source. */
async function syncMeasurement(template: Template, answers: Answers, submissionId: string, clientId: string, date: string, kind: "initial" | "checkin") {
  const codes = byCode(template);
  const val = (code: string) => { const q = codes.get(code); return q ? answers[q.id] : undefined; };
  const weight = val(kind === "initial" ? "weight_kg" : "avg_weight");
  const m = (kind === "checkin" && val("has_measurements") === true ? val("measurements") : null) as Record<string, number | null> | null;
  const row: Record<string, unknown> = { client_id: clientId, measured_on: date, source: kind, submission_id: submissionId, weight_kg: typeof weight === "number" ? weight : null };
  for (const f of ["waist_cm", "hips_cm", "chest_cm", "thigh_cm", "arm_cm"]) row[f] = m && typeof m[f] === "number" ? m[f] : null;
  const supabase = await createClient();
  await supabase.from("body_measurements").delete().eq("submission_id", submissionId);
  if (row.weight_kg != null || ["waist_cm", "hips_cm", "chest_cm", "thigh_cm", "arm_cm"].some((f) => row[f] != null)) {
    const { error } = await supabase.from("body_measurements").insert(row);
    if (error) console.error("[measurement sync]", error.code, error.message);
  }
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const MIME_BY_KIND: Record<string, RegExp> = {
  lab_result: /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/,
  assessment_photo: /^image\/(jpeg|png|webp|heic|heif)$/,
  progress_photo: /^image\/(jpeg|png|webp|heic|heif)$/,
  meal_photo: /^image\/(jpeg|png|webp|heic|heif)$/,
  assessment_video: /^video\/(mp4|quicktime|webm)$/,
  document: /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/,
  activity_file: /^(application\/(gpx\+xml|xml|octet-stream|vnd\.ant\.fit)|text\/xml|image\/(jpeg|png|webp|heic|heif))$/,
};

const fileSchema = z.object({
  kind: z.enum(["lab_result", "assessment_photo", "assessment_video", "progress_photo", "document", "meal_photo", "activity_file"]),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(100),
  size: z.number().int().positive().max(52428800),
  submissionId: uuid.optional(),
  questionId: uuid.optional(),
  diaryDayId: uuid.optional(),
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  angle: z.enum(["front", "side", "back"]).optional(),
});

export type RegisterFileInput = z.infer<typeof fileSchema>;

function guessMime(name: string, mime: string): string {
  if (mime) return mime;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "gpx") return "application/gpx+xml";
  if (ext === "fit") return "application/octet-stream";
  return "application/octet-stream";
}

/** Registers a file (consent is checked here by RLS) and returns the storage path to upload to. */
export async function registerFileAction(input: RegisterFileInput): Promise<ActionResult<{ id: string; path: string }>> {
  const v = await assertClient().catch(() => null);
  if (!v) return fail(t.errors.forbidden);
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return fail(t.validation.fileType);
  const f = parsed.data;
  const mime = guessMime(f.fileName, f.mimeType);
  if (!MIME_BY_KIND[f.kind].test(mime)) return fail(t.validation.fileType);
  const ext = (f.fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${v.client.id}/${f.kind}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.from("client_files").insert({
    client_id: v.client.id, kind: f.kind, storage_path: path, file_name: f.fileName.slice(0, 200), mime_type: mime, size_bytes: f.size,
    submission_id: f.submissionId ?? null, question_id: f.questionId ?? null, diary_day_id: f.diaryDayId ?? null,
    taken_on: f.takenOn ?? todayISO(), photo_angle: f.angle ?? null,
  }).select("id").single();
  if (error) return error.code === "42501" ? fail(t.errors.consentRequired) : dbError(error, "register file");
  return { ok: true, data: { id: data.id as string, path } };
}

export async function deleteFileAction(fileId: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!v || !uuid.safeParse(fileId).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { data: file } = await supabase.from("client_files").select("id, storage_path").eq("id", fileId).maybeSingle();
  if (!file) return fail(t.errors.notFound);
  const { error: sErr } = await supabase.storage.from("client-files").remove([file.storage_path as string]);
  if (sErr) console.error("[storage remove]", sErr.message);
  const { error } = await supabase.from("client_files").delete().eq("id", fileId);
  if (error) return dbError(error, "delete file");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signedUrlAction(fileId: string): Promise<ActionResult<{ url: string }>> {
  const v = await getViewer();
  if (!v || !uuid.safeParse(fileId).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { data: file } = await supabase.from("client_files").select("storage_path, file_name").eq("id", fileId).maybeSingle();
  if (!file) return fail(t.errors.notFound);
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(file.storage_path as string, 600);
  if (error || !data) return fail(t.errors.loadFailed);
  if (v.role === "coach") await supabase.rpc("log_coach_event", { p_table: "client_files", p_record: fileId, p_action: "VIEW_FILE" });
  return { ok: true, data: { url: data.signedUrl } };
}

// ---------------------------------------------------------------------------
// Coach review
// ---------------------------------------------------------------------------

export async function markReviewedAction(submissionId: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!v || v.role !== "coach" || !uuid.safeParse(submissionId).success) return fail(t.errors.forbidden);
  const supabase = await createClient();
  const { data, error } = await supabase.from("questionnaire_submissions").update({ status: "reviewed" }).eq("id", submissionId).eq("status", "submitted").select("client_id").maybeSingle();
  if (error) return dbError(error, "review");
  if (!data) return fail(t.errors.saveFailed);
  revalidatePath("/trener", "layout");
  return { ok: true };
}
