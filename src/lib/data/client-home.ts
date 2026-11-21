import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCheckinDeadline } from "./settings";
import { deadlineFor, isPastDeadline, previousWeek, weekStart } from "@/lib/utils/periods";
import { addDays, formatNumber, isoWeekday, todayISO } from "@/lib/utils/format";
import { currentWeekNumber } from "@/lib/strength/types";
import { computeRunningAnalytics } from "@/lib/running/analytics";
import { t } from "@/lib/i18n/sr";
import { getActiveProgramId, getProgramTree, getStrengthAnalytics, listSessions } from "./strength";
import { getActiveRunningProgramId, getRunningTree, listActivities } from "./running";
import { getActivePlanId, getNutritionTree } from "./nutrition";
import { estimateWorkoutDistanceM as estD, estimateWorkoutDurationS as estS } from "@/lib/utils/running";
import type { RSegment } from "@/lib/running/types";

export interface NextStep { key: "initial" | "initialContinue" | "diary" | "checkin" | "checkinContinue"; href: string; overdue?: boolean; deadline?: { date: string; hour: number } }

/** What the client should do next, in priority order. */
export async function getClientTasks(clientId: string, startDate: string): Promise<{ steps: NextStep[]; checkin: { status: "missing" | "draft" | "submitted" | "reviewed" | "notDue"; period: { start: string; end: string }; deadline: { date: string; hour: number }; overdue: boolean; id?: string } }> {
  const supabase = await createClient();
  const period = previousWeek();
  const deadlineSetting = await getCheckinDeadline();
  const [{ data: initials }, { data: days }, { data: checkin }] = await Promise.all([
    supabase.from("questionnaire_submissions").select("status").eq("client_id", clientId).eq("kind", "initial"),
    supabase.from("nutrition_diary_days").select("submitted_at").eq("client_id", clientId),
    supabase.from("questionnaire_submissions").select("id, status").eq("client_id", clientId).eq("kind", "checkin").eq("period_start", period.start).maybeSingle(),
  ]);
  const steps: NextStep[] = [];
  const initialDone = (initials ?? []).some((s) => s.status !== "draft");
  const initialDraft = (initials ?? []).some((s) => s.status === "draft");
  if (!initialDone) steps.push({ key: initialDraft ? "initialContinue" : "initial", href: "/klijent/upitnik" });
  const diaryDone = (days ?? []).filter((d) => d.submitted_at).length >= 3;
  if (initialDone && !diaryDone) steps.push({ key: "diary", href: "/klijent/dnevnik-ishrane" });

  const deadline = deadlineFor(period, deadlineSetting);
  const overdue = isPastDeadline(period, deadlineSetting);
  const due = startDate <= period.end;
  const status = !due ? "notDue" : checkin ? (checkin.status as "draft" | "submitted" | "reviewed") : "missing";
  if (status === "missing" || status === "draft") steps.push({ key: status === "draft" ? "checkinContinue" : "checkin", href: "/klijent/izvestaji", overdue, deadline });
  return { steps, checkin: { status, period, deadline, overdue, id: (checkin?.id as string) ?? undefined } };
}

export interface WeekItem { kind: "strength" | "run"; id: string; programId: string; title: string; sub: string; href: string; done: boolean; dow: number | null; planM?: number; planS?: number; type?: string }
export interface WeekHistoryRow {
  start: string; strengthDone: number; strengthPlanned: number; km: number; minutes: number; targetKm: number | null; targetMin: number | null;
  checkin: "sent" | "missing" | "pending" | "notDue"; weight: number | null;
  /** Food diary: days logged and days within ±10% of the kcal target (or simply logged when there is no target). */
  foodLogged: number; foodOnTarget: number; daysInWeek: number;
  /** Ring fill 0..1 (null = nothing planned to measure against). */
  rings: { strength: number | null; cardio: number | null; food: number | null };
}

/** Ring fill for one week: training done vs planned, running vs weekly target, food days on target out of 7. */
export function ringsFor(r: Omit<WeekHistoryRow, "rings">, hasFoodPlan: boolean): WeekHistoryRow["rings"] {
  const cap = (v: number) => Math.max(0, Math.min(1.25, v));
  return {
    strength: r.strengthPlanned > 0 ? cap(r.strengthDone / r.strengthPlanned) : null,
    cardio: r.targetMin ? cap(r.minutes / r.targetMin) : r.targetKm ? cap(r.km / r.targetKm) : null,
    food: hasFoodPlan || r.foodLogged > 0 ? cap(r.foodOnTarget / 7) : null,
  };
}
export interface ClientWeek {
  start: string;
  days: { date: string; dow: number; items: WeekItem[]; loggedStrength: number; loggedKm: number }[];
  flexible: WeekItem[];
  today: WeekItem[];
  strength: { id: string; done: number; planned: number; weekNo: number; weeks: number; name: string } | null;
  running: { id: string | null; km: number; target: number | null; min: number; targetMin: number | null; planned: number; done: number; weekNo: number; weeks: number; name: string } | null;
  nutrition: { id: string; name: string; eaten: number | null; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  prs: { name: string; weight: number | null; reps: number | null; e1rm: number | null }[];
  weeklyKm: { date: string; value: number }[];
  history: WeekHistoryRow[];
}

/**
 * One client's integrated week (strength + running + nutrition), what is done, a short history and a progress snapshot.
 * Works for the client and for coaches (RLS decides what can be read).
 */
export async function getClientWeek(clientId: string, opts: { snapshot?: boolean; historyWeeks?: number; startDate?: string } = {}): Promise<ClientWeek> {
  const { snapshot = true, historyWeeks = 0 } = opts;
  const today = todayISO();
  const monday = weekStart(today);
  const histStart = addDays(monday, -7 * Math.max(0, historyWeeks - 1));
  const supabase = await createClient();
  const [pid, rid, nid] = await Promise.all([getActiveProgramId(clientId), getActiveRunningProgramId(clientId), getActivePlanId(clientId)]);
  const [prog, run, plan, sessions, activities, sa, checkins, weights, eatenRows, foodRows] = await Promise.all([
    pid ? getProgramTree(pid) : null, rid ? getRunningTree(rid) : null, nid ? getNutritionTree(nid) : null,
    listSessions(clientId, { since: historyWeeks ? histStart : monday }), listActivities(clientId, snapshot ? 400 : 120),
    snapshot ? getStrengthAnalytics(clientId, 12) : null,
    historyWeeks ? supabase.from("questionnaire_submissions").select("period_start").eq("client_id", clientId).eq("kind", "checkin").neq("status", "draft").gte("period_start", histStart) : null,
    historyWeeks ? supabase.from("body_measurements").select("measured_on, weight_kg").eq("client_id", clientId).not("weight_kg", "is", null).gte("measured_on", histStart) : null,
    supabase.from("food_log_entries").select("kcal").eq("client_id", clientId).eq("logged_on", today),
    historyWeeks ? supabase.from("food_log_entries").select("logged_on, kcal").eq("client_id", clientId).gte("logged_on", histStart) : null,
  ]);
  const kcalByDay = new Map<string, number>();
  for (const r of foodRows?.error ? [] : foodRows?.data ?? []) kcalByDay.set(r.logged_on as string, (kcalByDay.get(r.logged_on as string) ?? 0) + Number(r.kcal));
  const eaten = eatenRows.error ? null : Math.round((eatenRows.data ?? []).reduce((a, r) => a + Number(r.kcal), 0));

  const done = sessions.filter((s) => s.status === "completed");
  const weekDone = done.filter((s) => s.performed_on >= monday);
  const doneDays = new Set(done.map((s) => s.training_day_id));
  const weekRuns = activities.filter((a) => a.performed_on >= monday);
  const runDone = new Set(activities.map((a) => a.workout_id));
  const items: WeekItem[] = [];

  let strength: ClientWeek["strength"] = null;
  if (prog && prog.weeks.length) {
    const n = currentWeekNumber(prog.start_date, today, prog.weeks.length);
    const wk = prog.weeks[n - 1];
    for (const d of wk.days) items.push({ kind: "strength", id: d.id, programId: prog.id, title: d.name, sub: t.strength.exercisesCount(d.exercises.length), href: `/klijent/treninzi/${d.id}`, done: doneDays.has(d.id), dow: d.day_of_week });
    strength = { id: prog.id, done: wk.days.filter((d) => doneDays.has(d.id)).length, planned: wk.days.length, weekNo: n, weeks: prog.weeks.length, name: prog.name };
  }
  let running: ClientWeek["running"] = null;
  const km = Math.round(weekRuns.reduce((a, r) => a + r.distance_m, 0) / 100) / 10;
  const minutes = Math.round(weekRuns.reduce((a, r) => a + r.duration_s, 0) / 60);
  if (run && run.weeks.length) {
    const n = currentWeekNumber(run.start_date, today, run.weeks.length);
    const wk = run.weeks[n - 1];
    for (const w of wk.workouts) items.push({ kind: "run", id: w.id, programId: run.id, title: w.title, sub: runSub(w.segments, formatNumber), href: `/klijent/trcanje?upis=${w.id}`, done: runDone.has(w.id), dow: w.day_of_week, planM: estD(w.segments), planS: estS(w.segments), type: t.running.types[w.workout_type] });
    running = { id: run.id, km, target: wk.target_km, min: minutes, targetMin: wk.target_minutes, planned: wk.workouts.length, done: wk.workouts.filter((w) => runDone.has(w.id)).length, weekNo: n, weeks: run.weeks.length, name: run.name };
  } else if (weekRuns.length) {
    running = { id: null, km, target: null, min: minutes, targetMin: null, planned: 0, done: weekRuns.length, weekNo: 0, weeks: 0, name: "" };
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return {
      date, dow: i + 1,
      items: items.filter((x) => x.dow === i + 1),
      loggedStrength: weekDone.filter((s) => s.performed_on === date).length,
      loggedKm: Math.round(weekRuns.filter((r) => r.performed_on === date).reduce((a, r) => a + r.distance_m, 0) / 100) / 10,
    };
  });
  const flexible = items.filter((x) => x.dow == null);
  const todayDow = isoWeekday(today);
  const todayItems = [...items.filter((x) => x.dow === todayDow), ...flexible.filter((x) => !x.done).slice(0, 2)];

  let prs: ClientWeek["prs"] = [];
  if (sa) {
    const top = [...sa.analytics.prs].filter((p) => p.e1rm != null).sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0)).slice(0, 4);
    const { data: exRows } = top.length ? await supabase.from("exercises").select("id, name").in("id", top.map((p) => p.exercise_id)) : { data: [] };
    const names = new Map((exRows ?? []).map((e) => [e.id as string, e.name as string]));
    prs = top.map((p) => ({ name: names.get(p.exercise_id) ?? "", weight: p.maxWeight, reps: p.maxWeightReps, e1rm: p.e1rm }));
  }

  // Last N weeks, newest first: plan vs. done, check-in and average weight.
  const history: WeekHistoryRow[] = [];
  for (let i = 0; i < historyWeeks; i++) {
    const start = addDays(monday, -7 * i), end = addDays(start, 6);
    const inWeek = (d: string) => d >= start && d <= end;
    const pw = prog?.weeks.length ? prog.weeks[currentWeekNumber(prog.start_date, start, prog.weeks.length) - 1] : null;
    const rw = run?.weeks.length ? run.weeks[currentWeekNumber(run.start_date, start, run.weeks.length) - 1] : null;
    const runsW = activities.filter((a) => inWeek(a.performed_on));
    const ws = (weights?.data ?? []).filter((w) => inWeek(w.measured_on as string)).map((w) => Number(w.weight_kg));
    const sentFor = new Set((checkins?.data ?? []).map((c) => c.period_start as string));
    let foodLogged = 0, foodOnTarget = 0;
    for (let d = 0; d < 7; d++) {
      const k = kcalByDay.get(addDays(start, d));
      if (!k) continue;
      foodLogged++;
      if (!plan?.kcal_target || Math.abs(k / plan.kcal_target - 1) <= 0.1) foodOnTarget++;
    }
    const row = {
      start,
      strengthDone: done.filter((x) => inWeek(x.performed_on)).length,
      strengthPlanned: pw && (!prog?.start_date || prog.start_date <= end) ? pw.days.length : 0,
      km: Math.round(runsW.reduce((a, r) => a + r.distance_m, 0) / 100) / 10,
      minutes: Math.round(runsW.reduce((a, r) => a + r.duration_s, 0) / 60),
      targetKm: rw && (!run?.start_date || run.start_date <= end) ? rw.target_km : null,
      targetMin: rw && (!run?.start_date || run.start_date <= end) ? rw.target_minutes : null,
      checkin: i === 0 || (opts.startDate && opts.startDate > end) ? "notDue" : sentFor.has(start) ? "sent" : i === 1 ? "pending" : "missing",
      weight: ws.length ? Math.round((ws.reduce((a, b) => a + b, 0) / ws.length) * 10) / 10 : null,
      foodLogged, foodOnTarget, daysInWeek: i === 0 ? isoWeekday(today) : 7,
    } as const;
    history.push({ ...row, rings: ringsFor(row, !!plan) });
  }

  return {
    start: monday, days, flexible, today: todayItems, strength, running,
    nutrition: plan ? { id: plan.id, name: plan.name, eaten, kcal: plan.kcal_target, protein: plan.protein_g, carbs: plan.carbs_g, fat: plan.fat_g } : null,
    prs, weeklyKm: snapshot ? computeRunningAnalytics(activities, 8, today).weeklyKm : [], history,
  };
}

function runSub(segments: RSegment[], formatNumber: (v: number, d?: number) => string): string {
  const d = estD(segments), sec = estS(segments);
  if (d > 0) return `~${formatNumber(d / 1000, 1)} km`;
  if (sec > 0) return `${Math.round(sec / 60)} min`;
  return "";
}
