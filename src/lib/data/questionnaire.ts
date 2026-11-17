import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Question, Template } from "@/lib/questionnaire/logic";
import type { SubmissionRow } from "./types";

export type ConsentType = "health_data" | "photos_videos" | "documents";
export type Consents = Record<ConsentType, boolean>;

export const getTemplate = cache(async (kind: "initial" | "checkin"): Promise<Template | null> => {
  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("questionnaire_templates").select("id, kind, name").eq("kind", kind).eq("is_active", true)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (!tpl) return null;
  return getTemplateById(tpl.id as string);
});

export const getTemplateById = cache(async (id: string): Promise<Template | null> => {
  const supabase = await createClient();
  const [{ data: tpl }, { data: sections }, { data: questions }] = await Promise.all([
    supabase.from("questionnaire_templates").select("id, kind, name").eq("id", id).maybeSingle(),
    supabase.from("questionnaire_sections").select("id, position, title, description").eq("template_id", id).order("position"),
    supabase.from("questionnaire_questions").select("id, section_id, position, code, label, help_text, type, options, unit, required, sensitive, condition").eq("template_id", id).order("position"),
  ]);
  if (!tpl) return null;
  return {
    id: tpl.id as string,
    kind: tpl.kind as Template["kind"],
    name: tpl.name as string,
    sections: (sections ?? []).map((s) => ({
      id: s.id as string, position: s.position as number, title: s.title as string, description: (s.description as string) ?? null,
      questions: ((questions ?? []) as Question[]).filter((q) => q.section_id === s.id),
    })),
  };
});

export interface SubmissionWithAnswers extends SubmissionRow { template_id: string; answers: Answers }

export async function getSubmission(id: string): Promise<SubmissionWithAnswers | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: sub }, { data: answers }] = await Promise.all([
    supabase.from("questionnaire_submissions").select("*").eq("id", id).maybeSingle(),
    supabase.from("questionnaire_answers").select("question_id, value").eq("submission_id", id),
  ]);
  if (!sub) return null;
  return { ...(sub as SubmissionWithAnswers), answers: Object.fromEntries((answers ?? []).map((a) => [a.question_id, a.value])) };
}

export async function listSubmissions(clientId: string, kind: "initial" | "checkin"): Promise<(SubmissionRow & { template_id: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("questionnaire_submissions").select("*").eq("client_id", clientId).eq("kind", kind)
    .order(kind === "checkin" ? "period_start" : "created_at", { ascending: false });
  return (data ?? []) as (SubmissionRow & { template_id: string })[];
}

export async function getConsents(clientId: string): Promise<Consents> {
  const supabase = await createClient();
  const { data } = await supabase.from("client_consents").select("consent_type, granted").eq("client_id", clientId);
  const out: Consents = { health_data: false, photos_videos: false, documents: false };
  for (const r of data ?? []) out[r.consent_type as ConsentType] = !!r.granted;
  return out;
}

export interface FileRow {
  id: string; client_id: string; kind: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number;
  taken_on: string | null; photo_angle: "front" | "side" | "back" | null; submission_id: string | null; question_id: string | null; diary_day_id: string | null; created_at: string;
}
const FILE_COLS = "id, client_id, kind, storage_path, file_name, mime_type, size_bytes, taken_on, photo_angle, submission_id, question_id, diary_day_id, created_at";

export async function listFiles(filter: { clientId?: string; submissionId?: string; kinds?: string[] }): Promise<FileRow[]> {
  const supabase = await createClient();
  let q = supabase.from("client_files").select(FILE_COLS).order("created_at", { ascending: false });
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.submissionId) q = q.eq("submission_id", filter.submissionId);
  if (filter.kinds) q = q.in("kind", filter.kinds);
  const { data } = await q;
  return (data ?? []) as FileRow[];
}

/** Short-lived signed URLs (10 min). Storage RLS decides what the viewer may read. */
export async function signFiles<T extends { storage_path: string }>(files: T[]): Promise<(T & { url: string | null })[]> {
  if (!files.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.storage.from("client-files").createSignedUrls(files.map((f) => f.storage_path), 600);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return files.map((f) => ({ ...f, url: map.get(f.storage_path) ?? null }));
}
