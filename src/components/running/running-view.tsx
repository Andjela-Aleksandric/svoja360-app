"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Footprints, Pencil, Plus, Trash2 } from "lucide-react";
import type { Activity, RunningTree, RWorkout } from "@/lib/running/types";
import { computeRunningAnalytics } from "@/lib/running/analytics";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { estimateWorkoutDistanceM, estimateWorkoutDurationS, formatDuration, formatPace, paceSecondsPerKm } from "@/lib/utils/running";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/trend-chart";
import { deleteActivityAction } from "@/app/actions/running";
import { ActivityForm } from "./activity-form";

export function WorkoutCard({ w, done, onLog }: { w: RWorkout; done: boolean; onLog?: () => void }) {
  const dist = estimateWorkoutDistanceM(w.segments), dur = estimateWorkoutDurationS(w.segments);
  return (
    <div className={cn("lift rounded-[18px] border p-4", done ? "border-success/30 bg-success-soft/40" : "border-line bg-surface")}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">{w.title}</div>
          <div className="text-xs text-muted">{t.running.types[w.workout_type]}{w.day_of_week ? ` · ${t.weekdays[w.day_of_week - 1]}` : ""}</div>
        </div>
        {done ? <Badge tone="success"><Check className="size-3.5" />{t.running.done}</Badge> : <span className="text-xs font-semibold tabular text-muted">{[dist > 0 ? `~${formatNumber(dist / 1000, 1)} km` : null, dur > 0 ? formatDuration(dur) : null].filter(Boolean).join(" · ")}</span>}
      </div>
      <ol className="grid gap-1 text-[13px]">
        {w.segments.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span className="w-24 shrink-0 font-semibold text-muted">{w.segments.length === 1 && s.segment_type === "main" ? t.running.wholeRun : t.running.segmentTypes[s.segment_type]}</span>
            <span className="text-ink-2">
              {s.repeat_count > 1 && <strong>{s.repeat_count}× </strong>}
              {s.distance_m ? `${s.distance_m >= 1000 ? `${formatNumber(s.distance_m / 1000, 2)} km` : `${s.distance_m} m`}` : s.duration_s ? formatDuration(s.duration_s) : ""}
              {(s.pace_min_s_km || s.pace_max_s_km) && ` @ ${formatPace(s.pace_min_s_km)}${s.pace_max_s_km && s.pace_max_s_km !== s.pace_min_s_km ? `–${formatPace(s.pace_max_s_km)}` : ""} min/km`}
              {(s.hr_min || s.hr_max) && ` · ${s.hr_min ?? ""}–${s.hr_max ?? ""} otk/min`}
              {s.recovery_s ? ` · ${t.running.recovery} ${formatDuration(s.recovery_s)}` : ""}
              {s.instructions && <span className="block text-muted">{s.instructions}</span>}
            </span>
          </li>
        ))}
      </ol>
      {w.notes && <p className="mt-2 rounded-[10px] bg-subtle px-3 py-2 text-[13px]">{w.notes}</p>}
      {onLog && !done && <Button size="sm" variant="primary" className="mt-3 w-full sm:w-auto" onClick={onLog}><Plus className="size-4" />{t.running.logThis}</Button>}
    </div>
  );
}

export function RunningView({ tree, currentWeek, activities, clientId, canDelete = true, openFor }: { tree: RunningTree | null; currentWeek: number; activities: Activity[]; clientId?: string; canDelete?: boolean; openFor?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const allWorkouts = (tree?.weeks ?? []).flatMap((w) => w.workouts);
  const presetFor = (w: RWorkout | undefined) => w ? { workout_id: w.id, title: w.title, km: estimateWorkoutDistanceM(w.segments) ? Math.round(estimateWorkoutDistanceM(w.segments) / 100) / 10 : null, duration_s: estimateWorkoutDurationS(w.segments) || null } : undefined;
  const [preset, setPreset] = useState(() => (openFor && !activities.some((a) => a.workout_id === openFor) ? presetFor(allWorkouts.find((w) => w.id === openFor)) : undefined));
  useEffect(() => { if (preset) setAdding(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);
  const [pending, start] = useTransition();
  const a = computeRunningAnalytics(activities);
  const week = tree?.weeks[currentWeek - 1];
  const doneIds = new Set(activities.map((x) => x.workout_id).filter(Boolean));
  const workoutOptions = (tree?.weeks ?? []).filter((w) => Math.abs(w.week_number - currentWeek) <= 1).flatMap((w) => w.workouts.map((x) => ({ id: x.id, label: `${t.strength.week(w.week_number)} · ${x.title}` })));
  const weekKmDone = a.weeklyKm.at(-1)?.value ?? 0;
  const plannedKm = week ? week.target_km ?? week.workouts.reduce((s, w) => s + estimateWorkoutDistanceM(w.segments), 0) / 1000 : null;
  const weekStartIso = a.weeklyKm.at(-1)?.date ?? "";
  const minDone = Math.round(activities.filter((x) => x.performed_on >= weekStartIso).reduce((s, x) => s + x.duration_s, 0) / 60);
  const byMinutes = week?.target_minutes != null;

  return (
    <div className="grid gap-4">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {byMinutes
          ? <StatCard label={t.running.thisWeek} value={`${minDone} min`} hint={`${t.workout.planned}: ${week!.target_minutes} min · ${formatNumber(weekKmDone, 1)} km`} />
          : <StatCard label={t.running.thisWeek} value={`${formatNumber(weekKmDone, 1)} km`} hint={plannedKm ? `${t.workout.planned}: ${formatNumber(plannedKm, 1)} km` : undefined} />}
        <StatCard label={t.running.totalDistance} value={`${formatNumber(a.totalKm, 1)} km`} />
        <StatCard label={t.running.avgPace} value={a.avgPace ? formatPace(a.avgPace) : "–"} hint={a.avgPace ? "min/km" : undefined} />
        <StatCard label={t.running.longest} value={a.longest ? `${formatNumber(a.longest.distance_m / 1000, 1)} km` : "–"} hint={a.longest ? formatDate(a.longest.performed_on) : undefined} />
      </div>

      {week && week.workouts.length > 0 && (
        <Card>
          <CardHeader title={`${t.running.schedule} · ${t.strength.week(currentWeek)}`} description={tree!.name} />
          <CardBody className="grid gap-3 md:grid-cols-2">{week.workouts.map((w) => <WorkoutCard key={w.id} w={w} done={doneIds.has(w.id)} onLog={() => { setPreset(presetFor(w)); setAdding(true); }} />)}</CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={t.running.weekly} /><CardBody><TrendChart data={a.weeklyKm} kind="bar" unit="km" ariaLabel={t.running.weekly} /></CardBody></Card>
        <Card><CardHeader title={t.running.paceProgression} description="min/km" /><CardBody>
          {a.pace.length > 1 ? <PaceChart data={a.pace} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}
        </CardBody></Card>
      </div>

      <Card>
        <CardHeader title={t.running.activities} action={<Button size="sm" onClick={() => { setPreset(undefined); setAdding(true); }}><Plus className="size-4" />{t.running.addActivity}</Button>} />
        <CardBody>
          {activities.length === 0 ? <EmptyState icon={<Footprints />} title={t.running.noActivities} className="border-0 py-6" /> : (
            <ul className="-mx-2 grid">
              {activities.slice(0, showAll ? 60 : 8).map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-hover">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{x.title || t.nav.client.running}</div>
                    <div className="text-xs text-muted">{formatDate(x.performed_on)} · {t.running.sources[x.source]}{x.avg_hr ? ` · ${x.avg_hr} otk/min` : ""}{x.rpe ? ` · RPE ${x.rpe}` : ""}</div>
                  </div>
                  <div className="text-right tabular">
                    <div className="font-bold">{formatNumber(x.distance_m / 1000, 2)} km</div>
                    <div className="text-xs text-muted">{formatDuration(x.duration_s)} · {formatPace(paceSecondsPerKm(x.distance_m, x.duration_s))}</div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEditing(x)}><Pencil /></Button>
                  {canDelete && <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setDeleting(x)}><Trash2 /></Button>}
                </li>
              ))}
              {activities.length > 8 && <li className="pt-2 text-center"><Button size="sm" variant="secondary" onClick={() => setShowAll(!showAll)}>{showAll ? t.common.showLess : t.common.showAll}</Button></li>}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={adding} onOpenChange={(o) => { setAdding(o); if (!o) setPreset(undefined); }} title={preset ? preset.title : t.running.addActivity} size="lg"><ActivityForm key={preset?.workout_id ?? "new"} preset={preset} workouts={workoutOptions} onDone={() => { setAdding(false); setPreset(undefined); }} clientId={clientId} allowImport={!clientId} /></Modal>
      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={t.common.edit} size="lg">{editing && <ActivityForm activity={editing} workouts={workoutOptions} onDone={() => setEditing(null)} clientId={clientId} />}</Modal>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={t.common.delete} description={t.running.deleteConfirm} confirmLabel={t.common.delete} loading={pending}
        onConfirm={() => deleting && start(async () => { const r = await deleteActivityAction(deleting.id); if (r.ok) { toast(t.running.deleted); setDeleting(null); router.refresh(); } else toast(r.error, "error"); })} />
    </div>
  );
}

function PaceChart({ data }: { data: { date: string; value: number }[] }) {
  // Faster pace is lower; the axis is inverted so improvement reads as going up.
  return <TrendChart data={data} unit="min/km" format={(v) => formatPace(Math.round(v))} invert ariaLabel={t.running.paceProgression} />;
}
