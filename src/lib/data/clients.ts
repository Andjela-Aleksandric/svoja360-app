import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow, MeasurementRow, ProgramSummary, SubmissionRow } from "./types";

export interface ClientListItem extends ClientRow {
  latestWeight: number | null;
  latestWeightOn: string | null;
  lastCheckin: Pick<SubmissionRow, "id" | "status" | "period_start" | "period_end" | "submitted_at"> | null;
  programs: { strength: ProgramSummary | null; running: ProgramSummary | null; nutrition: ProgramSummary | null };
  initialStatus: SubmissionRow["status"] | null;
}

const CLIENT_COLS = "id, user_id, full_name, email, phone, phone_e164, birth_date, height_cm, start_date, status, goal, archived_at, created_at";

/** Every client with the bits the list and dashboard need. Coaches only (RLS). */
export async function listClientsWithSummary(): Promise<ClientListItem[]> {
  const supabase = await createClient();
  const [clients, weights, checkins, initials, strength, running, nutrition] = await Promise.all([
    supabase.from("clients").select(CLIENT_COLS).order("full_name"),
    supabase.from("body_measurements").select("client_id, measured_on, weight_kg").not("weight_kg", "is", null).order("measured_on", { ascending: false }),
    supabase.from("questionnaire_submissions").select("id, client_id, status, period_start, period_end, submitted_at").eq("kind", "checkin").neq("status", "draft").order("period_start", { ascending: false }),
    supabase.from("questionnaire_submissions").select("client_id, status").eq("kind", "initial"),
    supabase.from("training_programs").select("id, client_id, name, status, start_date").eq("status", "active"),
    supabase.from("running_programs").select("id, client_id, name, status, start_date").eq("status", "active"),
    supabase.from("nutrition_plans").select("id, client_id, name, status, start_date").eq("status", "active"),
  ]);
  if (clients.error) throw clients.error;

  const firstBy = <T extends { client_id: string | null }>(rows: T[] | null) => {
    const m = new Map<string, T>();
    for (const r of rows ?? []) if (r.client_id && !m.has(r.client_id)) m.set(r.client_id, r);
    return m;
  };
  const w = firstBy(weights.data as { client_id: string; measured_on: string; weight_kg: number }[] | null);
  const c = firstBy(checkins.data as (SubmissionRow & { client_id: string })[] | null);
  const s = firstBy(strength.data as ProgramSummary[] | null);
  const r = firstBy(running.data as ProgramSummary[] | null);
  const n = firstBy(nutrition.data as ProgramSummary[] | null);
  const init = new Map<string, SubmissionRow["status"]>();
  for (const row of (initials.data ?? []) as { client_id: string; status: SubmissionRow["status"] }[]) {
    const prev = init.get(row.client_id);
    if (!prev || prev === "draft") init.set(row.client_id, row.status);
  }

  return (clients.data as ClientRow[]).map((cl) => ({
    ...cl,
    latestWeight: w.get(cl.id)?.weight_kg != null ? Number(w.get(cl.id)!.weight_kg) : null,
    latestWeightOn: w.get(cl.id)?.measured_on ?? null,
    lastCheckin: c.get(cl.id) ?? null,
    programs: { strength: s.get(cl.id) ?? null, running: r.get(cl.id) ?? null, nutrition: n.get(cl.id) ?? null },
    initialStatus: init.get(cl.id) ?? null,
  }));
}

export async function getClient(id: string): Promise<ClientRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select(CLIENT_COLS).eq("id", id).maybeSingle();
  return (data as ClientRow) ?? null;
}

export async function getMeasurements(clientId: string): Promise<MeasurementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("id, client_id, measured_on, weight_kg, waist_cm, hips_cm, chest_cm, thigh_cm, arm_cm, body_fat_pct, source, notes")
    .eq("client_id", clientId)
    .order("measured_on", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as MeasurementRow[]).map((m) => ({
    ...m,
    weight_kg: num(m.weight_kg), waist_cm: num(m.waist_cm), hips_cm: num(m.hips_cm), chest_cm: num(m.chest_cm),
    thigh_cm: num(m.thigh_cm), arm_cm: num(m.arm_cm), body_fat_pct: num(m.body_fat_pct),
  }));
}

/** PostgREST returns numeric columns as numbers or strings depending on size; normalise. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
