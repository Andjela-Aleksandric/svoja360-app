import Link from "next/link";
import { Check, ChevronRight, Dumbbell, Moon } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getActiveProgramId, getProgramTree, getSessionSets, listExercises, listSessions } from "@/lib/data/strength";
import { currentWeekNumber, formatReps } from "@/lib/strength/types";
import { totalVolume } from "@/lib/utils/training";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatNumber, todayISO } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/tabs";

export const metadata = { title: t.nav.client.workouts };

export default async function ClientWorkoutsPage({ searchParams }: { searchParams: Promise<{ nedelja?: string }> }) {
  const viewer = await requireClient();
  const programId = await getActiveProgramId(viewer.client.id);
  const [tree, exercises, sessions] = await Promise.all([programId ? getProgramTree(programId) : null, listExercises(true), listSessions(viewer.client.id, { limit: 30 })]);
  const sets = await getSessionSets(sessions.filter((s) => s.status === "completed").slice(0, 15).map((s) => s.id));
  const exName = new Map(exercises.map((e) => [e.id, e.name]));

  if (!tree) {
    return (<><PageHeader title={t.nav.client.workouts} /><EmptyState icon={<Dumbbell />} title={t.workout.noProgram} /></>);
  }
  const current = currentWeekNumber(tree.start_date, todayISO(), tree.weeks.length);
  const { nedelja } = await searchParams;
  const shown = Math.min(Math.max(Number(nedelja) || current, 1), tree.weeks.length);
  const week = tree.weeks[shown - 1];
  const doneDays = new Set(sessions.filter((s) => s.status === "completed" && s.training_day_id).map((s) => s.training_day_id!));

  return (
    <>
      <PageHeader eyebrow={t.workout.programWeek(current)} title={tree.name} description={tree.description ?? undefined} />
      {tree.weeks.length > 1 && (
        <div className="mb-4"><LinkTabs layoutId="client-weeks" active={String(shown)} items={tree.weeks.map((w) => ({ key: String(w.week_number), label: `${t.strength.week(w.week_number)}${w.week_number === current ? " •" : ""}`, href: `/klijent/treninzi?nedelja=${w.week_number}` }))} /></div>
      )}
      {week.is_deload && <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-info"><Moon className="size-4" />{t.strength.deload}</p>}

      <div className="stagger mb-8 grid gap-3 md:grid-cols-2">
        {week.days.length === 0 && <EmptyState title={t.strength.noDays} />}
        {week.days.map((d) => {
          const done = doneDays.has(d.id);
          return (
            <Link key={d.id} href={`/klijent/treninzi/${d.id}`} className={cn("group lift rounded-[22px] border p-5", done ? "border-success/30 bg-success-soft/40" : "border-line bg-surface hover:border-line-strong")}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[17px] font-bold">{d.name}</div>
                  {d.day_of_week && <div className="text-[13px] capitalize text-muted">{t.weekdays[d.day_of_week - 1]}</div>}
                </div>
                {done ? <Badge tone="success"><Check className="size-3.5" />{t.workout.done}</Badge> : <ChevronRight className="size-5 text-faint transition-transform group-hover:translate-x-0.5" />}
              </div>
              <ul className="grid gap-1 text-sm">
                {d.exercises.map((e) => {
                  const working = e.sets.filter((s) => s.set_type !== "warmup");
                  return (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span className="truncate text-ink-2">{e.superset_group && <span className="mr-1 font-bold text-accent">{e.superset_group}</span>}{exName.get(e.exercise_id)}</span>
                      <span className="shrink-0 tabular text-muted">{working.length}×{formatReps(working[0]?.reps_min ?? null, working[0]?.reps_max ?? null)}</span>
                    </li>
                  );
                })}
              </ul>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader title={t.workout.history} />
        <CardBody>
          {sessions.filter((s) => s.status === "completed").length === 0 ? <p className="text-sm text-muted">{t.workout.noHistory}</p> : (
            <ul className="-mx-2 grid">
              {sessions.filter((s) => s.status === "completed").slice(0, 15).map((s) => {
                const ss = sets.filter((x) => x.session_id === s.id && x.is_completed);
                const vol = totalVolume(ss);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="text-xs text-muted">{formatDate(s.performed_on)} · {ss.length} {t.workout.sets}</div>
                    </div>
                    <span className="text-sm font-semibold tabular">{vol ? `${formatNumber(vol, 0)} kg` : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
