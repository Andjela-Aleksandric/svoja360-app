import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listClientsWithSummary, type ClientListItem } from "./clients";
import { getCheckinDeadline } from "./settings";
import { isPastDeadline, previousWeek, weekStart } from "@/lib/utils/periods";
import { addDays, isoWeekday, todayISO } from "@/lib/utils/format";
import { currentWeekNumber } from "@/lib/strength/types";
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

export interface WeekRow {
  client: Pick<ClientListItem, "id" | "full_name" | "phone_e164">;
  strength: { done: number; planned: number } | null;
  running: { km: number; target: number | null; min: number; targetMin: number | null; runs: number } | null;
  lastCheckin: string | null;
  weight: { now: number; delta: number | null } | null;
  flagged: boolean;
}

export interface TodayRow { client: Pick<ClientListItem, "id" | "full_name" | "phone_e164">; items: { kind: "strength" | "run"; title: string; done: boolean }[] }

const numOr = (v: unknown) => (v == null ? null : Number(v));

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

  const activeIds = active.map((c) => c.id);
  const strengthIds = active.map((c) => c.programs.strength?.id).filter(Boolean) as string[];
  const runningIds = active.map((c) => c.programs.running?.id).filter(Boolean) as string[];
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [pending, reviewedWeek, lastAnswers, sessions, runs, subs, weights, weekSessions, weekRuns, tWeeks, tDays, rWeeks, history, rWorkouts] = await Promise.all([
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
    supabase.from("workout_sessions").select("client_id, training_day_id").eq("status", "completed").gte("performed_on", thisMonday).in("client_id", activeIds.length ? activeIds : none),
    supabase.from("running_activities").select("client_id, distance_m, duration_s, workout_id").gte("performed_on", thisMonday).in("client_id", activeIds.length ? activeIds : none),
    supabase.from("training_weeks").select("id, program_id, week_number").in("program_id", strengthIds.length ? strengthIds : none),
    supabase.from("training_days").select("id, week_id, day_of_week, name").in("program_id", strengthIds.length ? strengthIds : none),
    supabase.from("running_weeks").select("*").in("program_id", runningIds.length ? runningIds : none),
    supabase.from("body_measurements").select("client_id, measured_on, weight_kg").not("weight_kg", "is", null).gte("measured_on", addDays(today, -42)).in("client_id", activeIds.length ? activeIds : none).order("measured_on"),
    supabase.from("running_workouts").select("id, week_id, day_of_week, title").in("program_id", runningIds.length ? runningIds : none),
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

  // This week, per active client: what was planned vs. done.
  const weekBoard: WeekRow[] = active.map((c) => {
    const sp = c.programs.strength;
    let strength: WeekRow["strength"] = null;
    if (sp) {
      const ws = (tWeeks.data ?? []).filter((w) => w.program_id === sp.id);
      const n = currentWeekNumber(sp.start_date, today, ws.length);
      const wk = ws.find((w) => w.week_number === n);
      const planned = wk ? (tDays.data ?? []).filter((d) => d.week_id === wk.id).length : 0;
      const done = (weekSessions.data ?? []).filter((x) => x.client_id === c.id).length;
      strength = { done, planned };
    }
    const rp = c.programs.running;
    const myRuns = (weekRuns.data ?? []).filter((x) => x.client_id === c.id);
    let running: WeekRow["running"] = null;
    if (rp || myRuns.length) {
      const ws = rp ? (rWeeks.data ?? []).filter((w) => w.program_id === rp.id) : [];
      const n = rp ? currentWeekNumber(rp.start_date, today, ws.length) : 0;
      const wk = ws.find((w) => w.week_number === n) as { target_km?: unknown; target_minutes?: unknown } | undefined;
      running = { km: Math.round(myRuns.reduce((a, r) => a + r.distance_m, 0) / 100) / 10, target: numOr(wk?.target_km), min: Math.round(myRuns.reduce((a, r) => a + r.duration_s, 0) / 60), targetMin: numOr(wk?.target_minutes), runs: myRuns.length };
    }
    const hist = (history.data ?? []).filter((h) => h.client_id === c.id);
    const weight = c.latestWeight != null ? { now: c.latestWeight, delta: hist.length > 1 ? Math.round((Number(hist[hist.length - 1].weight_kg) - Number(hist[0].weight_kg)) * 10) / 10 : null } : null;
    return { client: { id: c.id, full_name: c.full_name, phone_e164: c.phone_e164 }, strength, running, lastCheckin: c.lastCheckin?.submitted_at ?? null, weight, flagged: attention.some((a) => a.client.id === c.id && a.reasons.some((r) => r === "pain" || r === "missingCheckin" || r === "highStress")) };
  });
  // Who has something scheduled today, and is it done.
  const todayDow = isoWeekday(today);
  const doneDayIds = new Set((weekSessions.data ?? []).map((x) => x.training_day_id));
  const doneRunIds = new Set((weekRuns.data ?? []).map((x) => x.workout_id));
  const todayPlan: TodayRow[] = [];
  for (const c of active) {
    const rows: TodayRow["items"] = [];
    const sp = c.programs.strength;
    if (sp) {
      const ws = (tWeeks.data ?? []).filter((w) => w.program_id === sp.id);
      const wk = ws.find((w) => w.week_number === currentWeekNumber(sp.start_date, today, ws.length));
      for (const d of (tDays.data ?? []).filter((d) => wk && d.week_id === wk.id && d.day_of_week === todayDow)) rows.push({ kind: "strength", title: d.name as string, done: doneDayIds.has(d.id) });
    }
    const rp = c.programs.running;
    if (rp) {
      const ws = (rWeeks.data ?? []).filter((w) => w.program_id === rp.id) as { id: string; week_number: number }[];
      const wk = ws.find((w) => w.week_number === currentWeekNumber(rp.start_date, today, ws.length));
      for (const w of (rWorkouts.data ?? []).filter((w) => wk && w.week_id === wk.id && w.day_of_week === todayDow)) rows.push({ kind: "run", title: w.title as string, done: doneRunIds.has(w.id) });
    }
    if (rows.length) todayPlan.push({ client: { id: c.id, full_name: c.full_name, phone_e164: c.phone_e164 }, items: rows });
  }
  todayPlan.sort((a, b) => Number(a.items.every((i) => i.done)) - Number(b.items.every((i) => i.done)));

  const plannedTotal = weekBoard.reduce((a, r) => a + (r.strength?.planned ?? 0), 0);
  const doneTotal = weekBoard.reduce((a, r) => a + Math.min(r.strength?.done ?? 0, r.strength?.planned ?? 0), 0);

  return {
    todayPlan,
    weekBoard,
    week: {
      start: thisMonday,
      workoutsDone: (weekSessions.data ?? []).length,
      compliance: plannedTotal ? Math.round((doneTotal / plannedTotal) * 100) : null,
      km: Math.round((weekRuns.data ?? []).reduce((a, r) => a + r.distance_m, 0) / 100) / 10,
      runs: (weekRuns.data ?? []).length,
    },
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
