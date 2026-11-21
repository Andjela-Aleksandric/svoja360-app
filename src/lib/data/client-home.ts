import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCheckinDeadline } from "./settings";
import { deadlineFor, isPastDeadline, previousWeek } from "@/lib/utils/periods";

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

export interface WeekItem { kind: "strength" | "run"; id: string; title: string; sub: string; href: string; done: boolean; dow: number | null }
export interface ClientWeek {
  start: string;
  days: { date: string; dow: number; items: WeekItem[]; loggedStrength: number; loggedKm: number }[];
  flexible: WeekItem[];
  strength: { done: number; planned: number; weekNo: number; weeks: number; name: string } | null;
  running: { km: number; target: number | null; planned: number; done: number; weekNo: number; weeks: number; name: string } | null;
  nutrition: { name: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } | null;
  prs: { name: string; weight: number | null; reps: number | null; e1rm: number | null }[];
  weeklyKm: { date: string; value: number }[];
}

/** Everything the client home shows: this week's plan (strength + running), what's done, and a progress snapshot. */
export async function getClientWeek(clientId: string): Promise<ClientWeek> {
  const [{ getActiveProgramId, getProgramTree, listSessions, getStrengthAnalytics }, { getActiveRunningProgramId, getRunningTree, listActivities }, { getActivePlanId, getNutritionTree }, { currentWeekNumber }, { computeRunningAnalytics }, fmt, { weekStart }, { estimateWorkoutDistanceM }, { t }] = await Promise.all([
    import("./strength"), import("./running"), import("./nutrition"), import("@/lib/strength/types"), import("@/lib/running/analytics"), import("@/lib/utils/format"), import("@/lib/utils/periods"), import("@/lib/utils/running"), import("@/lib/i18n/sr"),
  ]);
  const today = fmt.todayISO();
  const monday = weekStart(today);
  const [pid, rid, nid] = await Promise.all([getActiveProgramId(clientId), getActiveRunningProgramId(clientId), getActivePlanId(clientId)]);
  const [prog, run, plan, sessions, activities, sa] = await Promise.all([
    pid ? getProgramTree(pid) : null, rid ? getRunningTree(rid) : null, nid ? getNutritionTree(nid) : null,
    listSessions(clientId, { since: monday }), listActivities(clientId, 400), getStrengthAnalytics(clientId, 12),
  ]);

  const done = sessions.filter((s) => s.status === "completed");
  const doneDays = new Set(done.map((s) => s.training_day_id));
  const weekRuns = activities.filter((a) => a.performed_on >= monday);
  const runDone = new Set(activities.map((a) => a.workout_id));
  const items: WeekItem[] = [];

  let strength: ClientWeek["strength"] = null;
  if (prog && prog.weeks.length) {
    const n = currentWeekNumber(prog.start_date, today, prog.weeks.length);
    const wk = prog.weeks[n - 1];
    for (const d of wk.days) items.push({ kind: "strength", id: d.id, title: d.name, sub: t.strength.exercisesCount(d.exercises.length), href: `/klijent/treninzi/${d.id}`, done: doneDays.has(d.id), dow: d.day_of_week });
    strength = { done: wk.days.filter((d) => doneDays.has(d.id)).length, planned: wk.days.length, weekNo: n, weeks: prog.weeks.length, name: prog.name };
  }
  let running: ClientWeek["running"] = null;
  const km = Math.round(weekRuns.reduce((a, r) => a + r.distance_m, 0) / 100) / 10;
  if (run && run.weeks.length) {
    const n = currentWeekNumber(run.start_date, today, run.weeks.length);
    const wk = run.weeks[n - 1];
    for (const w of wk.workouts) items.push({ kind: "run", id: w.id, title: w.title, sub: `~${fmt.formatNumber(estimateWorkoutDistanceM(w.segments) / 1000, 1)} km`, href: "/klijent/trcanje", done: runDone.has(w.id), dow: w.day_of_week });
    running = { km, target: wk.target_km, planned: wk.workouts.length, done: wk.workouts.filter((w) => runDone.has(w.id)).length, weekNo: n, weeks: run.weeks.length, name: run.name };
  } else if (weekRuns.length) {
    running = { km, target: null, planned: 0, done: weekRuns.length, weekNo: 0, weeks: 0, name: "" };
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = fmt.addDays(monday, i);
    return {
      date, dow: i + 1,
      items: items.filter((x) => x.dow === i + 1),
      loggedStrength: done.filter((s) => s.performed_on === date).length,
      loggedKm: Math.round(weekRuns.filter((r) => r.performed_on === date).reduce((a, r) => a + r.distance_m, 0) / 100) / 10,
    };
  });

  const top = [...sa.analytics.prs].filter((p) => p.e1rm != null).sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0)).slice(0, 4);
  const supabase = await createClient();
  const { data: exRows } = top.length ? await supabase.from("exercises").select("id, name").in("id", top.map((p) => p.exercise_id)) : { data: [] };
  const names = new Map((exRows ?? []).map((e) => [e.id as string, e.name as string]));
  const prs = top
    .map((p) => ({ name: names.get(p.exercise_id) ?? "", weight: p.maxWeight, reps: p.maxWeightReps, e1rm: p.e1rm }));
  const ra = computeRunningAnalytics(activities, 8, today);

  return {
    start: monday, days, flexible: items.filter((x) => x.dow == null), strength, running,
    nutrition: plan ? { name: plan.name, kcal: plan.kcal_target, protein: plan.protein_g, carbs: plan.carbs_g, fat: plan.fat_g } : null,
    prs, weeklyKm: ra.weeklyKm,
  };
}
