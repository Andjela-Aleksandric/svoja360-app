import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listClientsWithSummary, type ClientListItem } from "./clients";
import { getCheckinDeadline } from "./settings";
import { isPastDeadline, previousWeek, weekStart } from "@/lib/utils/periods";
import { todayISO } from "@/lib/utils/format";
import { t } from "@/lib/i18n/sr";

export type AttentionReason = keyof typeof t.dashboard.reasons;

export interface AttentionItem {
  client: Pick<ClientListItem, "id" | "full_name" | "phone_e164">;
  reasons: AttentionReason[];
  checkinId?: string;
}

export interface ActivityItem {
  id: string;
  kind: keyof typeof t.dashboard.activity;
  clientId: string;
  clientName: string;
  at: string;
  detail?: string;
  href: string;
}

export async function getCoachDashboard() {
  const supabase = await createClient();
  const today = todayISO();
  const period = previousWeek(today);
  const deadline = await getCheckinDeadline();
  const pastDeadline = isPastDeadline(period, deadline);
  const monthStart = today.slice(0, 8) + "01";
  const thisMonday = weekStart(today);

  const clients = await listClientsWithSummary();
  const active = clients.filter((c) => c.status === "active");
  const names = new Map(clients.map((c) => [c.id, c.full_name]));

  const [pending, reviewedWeek, lastAnswers, sessions, runs, subs, weights] = await Promise.all([
    supabase.from("questionnaire_submissions").select("id", { count: "exact", head: true }).eq("kind", "checkin").eq("status", "submitted"),
    supabase.from("questionnaire_submissions").select("id", { count: "exact", head: true }).eq("kind", "checkin").eq("status", "reviewed").gte("reviewed_at", `${thisMonday}T00:00:00`),
    supabase
      .from("questionnaire_answers")
      .select("value, question:questionnaire_questions!inner(code), submission:questionnaire_submissions!inner(id, client_id, kind, status, period_start)")
      .eq("submission.kind", "checkin")
      .eq("submission.period_start", period.start)
      .in("submission.status", ["submitted", "reviewed"])
      .in("question.code", ["strength_pain", "stress", "nutrition_adherence"]),
    supabase.from("workout_sessions").select("id, client_id, name, finished_at").eq("status", "completed").order("finished_at", { ascending: false }).limit(10),
    supabase.from("running_activities").select("id, client_id, distance_m, created_at").order("created_at", { ascending: false }).limit(10),
    supabase.from("questionnaire_submissions").select("id, client_id, kind, submitted_at").neq("status", "draft").not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(10),
    supabase.from("body_measurements").select("id, client_id, weight_kg, created_at").not("weight_kg", "is", null).eq("source", "manual").order("created_at", { ascending: false }).limit(10),
  ]);

  // Signals from last week's check-ins.
  const flags = new Map<string, Set<AttentionReason>>();
  const checkinIdBy = new Map<string, string>();
  type AnswerRow = { value: unknown; question: { code: string }; submission: { id: string; client_id: string } };
  for (const a of (lastAnswers.data ?? []) as unknown as AnswerRow[]) {
    const set = flags.get(a.submission.client_id) ?? new Set<AttentionReason>();
    if (a.question.code === "strength_pain" && a.value === true) set.add("pain");
    if (a.question.code === "stress" && Number(a.value) >= 8) set.add("highStress");
    if (a.question.code === "nutrition_adherence" && Number(a.value) <= 4) set.add("lowAdherence");
    flags.set(a.submission.client_id, set);
    checkinIdBy.set(a.submission.client_id, a.submission.id);
  }

  const attention: AttentionItem[] = [];
  for (const c of active) {
    const reasons = new Set<AttentionReason>(flags.get(c.id) ?? []);
    const startedBeforePeriodEnd = c.start_date <= period.end;
    if (pastDeadline && startedBeforePeriodEnd && c.lastCheckin?.period_start !== period.start) reasons.add("missingCheckin");
    if (!c.programs.strength && !c.programs.running && !c.programs.nutrition) reasons.add("noProgram");
    if (c.initialStatus !== "submitted" && c.initialStatus !== "reviewed") reasons.add("initialPending");
    if (reasons.size) attention.push({ client: { id: c.id, full_name: c.full_name, phone_e164: c.phone_e164 }, reasons: [...reasons], checkinId: checkinIdBy.get(c.id) });
  }
  const weight: Record<AttentionReason, number> = { pain: 6, highStress: 5, missingCheckin: 4, lowAdherence: 3, initialPending: 2, noProgram: 1 };
  attention.sort((a, b) => Math.max(...b.reasons.map((r) => weight[r])) - Math.max(...a.reasons.map((r) => weight[r])) || b.reasons.length - a.reasons.length);

  const activity: ActivityItem[] = [];
  for (const s of sessions.data ?? []) if (s.finished_at) activity.push({ id: `w${s.id}`, kind: "workout", clientId: s.client_id, clientName: names.get(s.client_id) ?? "", at: s.finished_at, detail: s.name, href: `/trener/klijenti/${s.client_id}` });
  for (const r of runs.data ?? []) activity.push({ id: `r${r.id}`, kind: "run", clientId: r.client_id, clientName: names.get(r.client_id) ?? "", at: r.created_at, detail: `${(r.distance_m / 1000).toFixed(1).replace(".", ",")} km`, href: `/trener/klijenti/${r.client_id}` });
  for (const s of subs.data ?? []) activity.push({ id: `s${s.id}`, kind: s.kind === "checkin" ? "checkin" : "initial", clientId: s.client_id, clientName: names.get(s.client_id) ?? "", at: s.submitted_at!, href: `/trener/klijenti/${s.client_id}` });
  for (const m of weights.data ?? []) activity.push({ id: `m${m.id}`, kind: "weight", clientId: m.client_id, clientName: names.get(m.client_id) ?? "", at: m.created_at, detail: `${String(m.weight_kg).replace(".", ",")} kg`, href: `/trener/klijenti/${m.client_id}?tab=measurements` });
  activity.sort((a, b) => b.at.localeCompare(a.at));

  return {
    stats: {
      active: active.length,
      newThisMonth: clients.filter((c) => c.start_date >= monthStart).length,
      pending: pending.count ?? 0,
      reviewedThisWeek: reviewedWeek.count ?? 0,
    },
    attention,
    activity: activity.slice(0, 12),
    period,
  };
}
