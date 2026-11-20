import Link from "next/link";
import { Apple, Check, ChevronRight, Dumbbell, Footprints } from "lucide-react";
import { getActiveProgramId, getProgramTree, listSessions } from "@/lib/data/strength";
import { getActiveRunningProgramId, getRunningTree, listActivities } from "@/lib/data/running";
import { getActivePlanId, getNutritionTree } from "@/lib/data/nutrition";
import { currentWeekNumber } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { isoWeekday, todayISO, formatNumber } from "@/lib/utils/format";
import { weekStart } from "@/lib/utils/periods";
import { estimateWorkoutDistanceM } from "@/lib/utils/running";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";

export async function ClientToday({ clientId }: { clientId: string }) {
  const today = todayISO();
  const wd = isoWeekday(today);
  const [pid, rid, nid] = await Promise.all([getActiveProgramId(clientId), getActiveRunningProgramId(clientId), getActivePlanId(clientId)]);
  const [prog, run, plan, sessions, activities] = await Promise.all([
    pid ? getProgramTree(pid) : null, rid ? getRunningTree(rid) : null, nid ? getNutritionTree(nid) : null,
    listSessions(clientId, { since: weekStart(today) }), listActivities(clientId, 30),
  ]);

  const week = prog ? prog.weeks[currentWeekNumber(prog.start_date, today, prog.weeks.length) - 1] : null;
  const doneDays = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.training_day_id));
  const todayDay = week?.days.find((d) => d.day_of_week === wd) ?? week?.days.find((d) => !doneDays.has(d.id) && !d.day_of_week);
  const doneThisWeek = week ? week.days.filter((d) => doneDays.has(d.id)).length : 0;

  const rweek = run ? run.weeks[currentWeekNumber(run.start_date, today, run.weeks.length) - 1] : null;
  const runDone = new Set(activities.map((a) => a.workout_id));
  const nextRun = rweek?.workouts.find((w) => !runDone.has(w.id) && (w.day_of_week == null || w.day_of_week >= wd));

  if (!prog && !run && !plan) {
    return <Card><CardHeader title={t.clientHome.todayTraining} /><CardBody><p className="text-sm text-muted">{t.clientHome.noPlanYet}</p></CardBody></Card>;
  }
  return (
    <Card>
      <CardHeader title={t.clientHome.todayTraining} />
      <CardBody className="stagger grid gap-2.5">
        {prog && (todayDay ? (
          <Link href={`/klijent/treninzi/${todayDay.id}`} className="group lift flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 bg-accent-soft text-accent">{doneDays.has(todayDay.id) ? <Check className="size-5" /> : <Dumbbell className="size-5" />}</span>
            <div className="min-w-0 flex-1"><div className="font-bold">{todayDay.name}</div><div className="text-xs text-muted">{t.strength.exercisesCount(todayDay.exercises.length)}</div></div>
            <ChevronRight className="size-4 text-faint group-hover:translate-x-0.5" />
          </Link>
        ) : <p className="flex items-center gap-2 text-sm text-muted"><Dumbbell className="size-4" />{t.clientHome.restDay}</p>)}
        {nextRun && (
          <Link href="/klijent/trcanje" className="group lift flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 bg-info-soft text-info"><Footprints className="size-5" /></span>
            <div className="min-w-0 flex-1"><div className="font-bold">{nextRun.title}</div><div className="text-xs text-muted">{t.clientHome.upcomingRun}{nextRun.day_of_week ? ` · ${t.weekdays[nextRun.day_of_week - 1]}` : ""} · ~{formatNumber(estimateWorkoutDistanceM(nextRun.segments) / 1000, 1)} km</div></div>
            <ChevronRight className="size-4 text-faint group-hover:translate-x-0.5" />
          </Link>
        )}
        {plan && (
          <Link href="/klijent/ishrana" className="group lift flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 bg-success-soft text-success"><Apple className="size-5" /></span>
            <div className="min-w-0 flex-1"><div className="font-bold">{t.clientHome.todayNutrition}</div><div className="text-xs text-muted">{plan.kcal_target ? `${plan.kcal_target} kcal · ` : ""}{plan.protein_g ? `${t.nutrition.protein} ${plan.protein_g} g` : plan.name}</div></div>
            <ChevronRight className="size-4 text-faint group-hover:translate-x-0.5" />
          </Link>
        )}
        {week && week.days.length > 0 && (
          <div className="mt-1">
            <div className="mb-1.5 flex justify-between text-[13px] font-semibold"><span className="text-muted">{t.clientHome.weekProgress}</span><span>{t.clientHome.workoutsDone(doneThisWeek, week.days.length)}</span></div>
            <ProgressBar value={doneThisWeek} max={week.days.length} tone="accent" label={t.clientHome.weekProgress} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
