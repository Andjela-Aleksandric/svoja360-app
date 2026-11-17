import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listClientsWithSummary } from "./clients";
import { previousWeek } from "@/lib/utils/periods";

export const TREND_CODES = ["avg_weight", "nutrition_adherence", "sleep_quality", "sleep_hours", "recovery_energy", "stress", "mood_motivation", "hunger"] as const;
export type TrendCode = (typeof TREND_CODES)[number];

export interface CheckinPoint { submissionId: string; periodStart: string; periodEnd: string; status: string; values: Partial<Record<TrendCode | "strength_done" | "strength_planned" | "cardio_done" | "cardio_planned", number>> }

/** Numeric answers of the last `limit` submitted check-ins, oldest first. */
export async function getCheckinSeries(clientId: string, limit = 12): Promise<CheckinPoint[]> {
  const supabase = await createClient();
  const { data: subs } = await supabase.from("questionnaire_submissions").select("id, period_start, period_end, status")
    .eq("client_id", clientId).eq("kind", "checkin").neq("status", "draft").order("period_start", { ascending: false }).limit(limit);
  if (!subs?.length) return [];
  const { data: answers } = await supabase.from("questionnaire_answers")
    .select("submission_id, value, question:questionnaire_questions!inner(code)")
    .in("submission_id", subs.map((s) => s.id));
  const by = new Map<string, CheckinPoint>(subs.map((s) => [s.id as string, { submissionId: s.id as string, periodStart: s.period_start as string, periodEnd: s.period_end as string, status: s.status as string, values: {} }]));
  for (const a of (answers ?? []) as unknown as { submission_id: string; value: unknown; question: { code: string } }[]) {
    const p = by.get(a.submission_id)!;
    const code = a.question.code;
    if ((TREND_CODES as readonly string[]).includes(code) && typeof a.value === "number") p.values[code as TrendCode] = a.value;
    if (code === "strength_sessions" || code === "cardio_sessions") {
      const v = a.value as { planned?: number; done?: number };
      const k = code === "strength_sessions" ? "strength" : "cardio";
      if (typeof v?.planned === "number") p.values[`${k}_planned`] = v.planned;
      if (typeof v?.done === "number") p.values[`${k}_done`] = v.done;
    }
  }
  return [...by.values()].reverse();
}

export interface CheckinListRow { id: string; client_id: string; client_name: string; phone_e164: string | null; period_start: string; period_end: string; status: string; submitted_at: string | null; reviewed_at: string | null }

export async function listCheckinsForCoach(periodStart: string) {
  const supabase = await createClient();
  const [{ data: subs }, clients] = await Promise.all([
    supabase.from("questionnaire_submissions").select("id, client_id, period_start, period_end, status, submitted_at, reviewed_at").eq("kind", "checkin").eq("period_start", periodStart).neq("status", "draft"),
    listClientsWithSummary(),
  ]);
  const map = new Map(clients.map((c) => [c.id, c]));
  const rows: CheckinListRow[] = (subs ?? []).map((s) => ({ ...(s as Omit<CheckinListRow, "client_name" | "phone_e164">), client_name: map.get(s.client_id as string)?.full_name ?? "", phone_e164: map.get(s.client_id as string)?.phone_e164 ?? null }));
  const submittedIds = new Set(rows.map((r) => r.client_id));
  const periodEnd = previousWeekEnd(periodStart);
  const missing = clients.filter((c) => c.status === "active" && c.start_date <= periodEnd && !submittedIds.has(c.id));
  return {
    toReview: rows.filter((r) => r.status === "submitted").sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")),
    reviewed: rows.filter((r) => r.status === "reviewed").sort((a, b) => a.client_name.localeCompare(b.client_name, "sr")),
    missing: missing.map((c) => ({ id: c.id, full_name: c.full_name, phone_e164: c.phone_e164 })),
  };
}

function previousWeekEnd(start: string) {
  const d = new Date(start + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export { previousWeek };
