"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Check, ExternalLink, History, Plus, SkipForward, Trophy } from "lucide-react";
import type { PDay } from "@/lib/strength/types";
import type { LoggedSet } from "@/lib/data/strength";
import { formatReps } from "@/lib/strength/types";
import { bestE1RM, totalVolume } from "@/lib/utils/training";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatNumber, todayISO } from "@/lib/utils/format";
import { logWorkoutAction, type WorkoutPayload } from "@/app/actions/workouts";
import { clearDraft, enqueue, loadDraft, saveDraft } from "@/lib/strength/offline-queue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { NumCell } from "./num-cell";
import { RestTimer, type RestState } from "./rest-timer";

interface LogSet {
  key: string; exercise_id: string; prescription_set_id: string | null; exercise_position: number; position: number;
  set_type: "warmup" | "working" | "dropset"; target: string | null; reps: number | null; weight_kg: number | null; rir: number | null;
  is_completed: boolean; completed_at: string | null;
}
interface Draft { id: string; started_at: string | null; performed_on: string; notes: string; sets: LogSet[]; skipped: string[]; updated: number }

type ExInfo = { id: string; name: string; instructions: string | null; media_url: string | null; equipment: string };

function fromPlan(day: PDay, previous: Record<string, { sets: { reps: number | null; weight_kg: number | null }[] }>): LogSet[] {
  return day.exercises.flatMap((e, ei) => e.sets.map((s, si) => {
    const prevSet = previous[e.exercise_id]?.sets[si - e.sets.filter((x, i) => i < si && x.set_type === "warmup").length];
    return {
      key: crypto.randomUUID(), exercise_id: e.exercise_id, prescription_set_id: s.id, exercise_position: ei, position: si, set_type: s.set_type,
      target: `${formatReps(s.reps_min, s.reps_max)}${s.weight_kg != null ? ` × ${formatNumber(s.weight_kg, 2)} kg` : ""}${s.rir != null ? ` · RIR ${formatNumber(s.rir)}` : ""}${s.rpe != null ? ` · RPE ${formatNumber(s.rpe)}` : ""}`,
      reps: s.reps_max ?? s.reps_min, weight_kg: s.weight_kg ?? (s.set_type !== "warmup" ? prevSet?.weight_kg ?? null : null), rir: null,
      is_completed: false, completed_at: null,
    };
  }));
}

export function WorkoutLogger({ programId, day, weekNumber, exercises, previous, existing }: {
  programId: string; day: PDay; weekNumber: number; exercises: ExInfo[];
  previous: Record<string, { date: string; sets: { reps: number | null; weight_kg: number | null }[] }>;
  existing: { id: string; started_at: string | null; finished_at: string | null; status: string; notes: string | null; performed_on: string; sets: LoggedSet[] } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const [rest, setRest] = useState<RestState | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, start] = useTransition();
  const [queuedDone, setQueuedDone] = useState(false);
  const finished = existing?.status === "completed";

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const planned = fromPlan(day, previous);
      return {
        id: existing.id, started_at: existing.started_at, performed_on: existing.performed_on, notes: existing.notes ?? "", updated: Date.now(),
        skipped: [...new Set(existing.sets.filter((s) => s.is_skipped).map((s) => s.exercise_id))],
        sets: existing.sets.map((s) => ({ key: crypto.randomUUID(), exercise_id: s.exercise_id, prescription_set_id: null, exercise_position: s.exercise_position, position: s.position, set_type: s.set_type,
          target: planned.find((p) => p.exercise_position === s.exercise_position && p.position === s.position)?.target ?? null,
          reps: s.reps, weight_kg: s.weight_kg, rir: s.rir, is_completed: s.is_completed, completed_at: null })),
      };
    }
    return { id: crypto.randomUUID(), started_at: null, performed_on: todayISO(), notes: "", sets: fromPlan(day, previous), skipped: [], updated: Date.now() };
  });

  // Restore an unfinished workout from this device.
  useEffect(() => {
    if (finished) return;
    const saved = loadDraft<Draft>(day.id);
    if (saved && saved.sets?.length) setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!finished && draft.started_at) saveDraft(day.id, draft); }, [draft, day.id, finished]);

  const patch = useCallback((key: string, p: Partial<LogSet>) => setDraft((d) => ({ ...d, updated: Date.now(), sets: d.sets.map((s) => (s.key === key ? { ...s, ...p } : s)) })), []);

  function toggle(s: LogSet, restSeconds: number | null) {
    const done = !s.is_completed;
    setDraft((d) => ({ ...d, started_at: d.started_at ?? new Date().toISOString(), updated: Date.now(), sets: d.sets.map((x) => (x.key === s.key ? { ...x, is_completed: done, completed_at: done ? new Date().toISOString() : null } : x)) }));
    if (done && restSeconds) setRest({ endsAt: Date.now() + restSeconds * 1000, total: restSeconds });
  }

  const completed = draft.sets.filter((s) => s.is_completed && !draft.skipped.includes(s.exercise_id));
  const volume = totalVolume(completed);
  const progress = draft.sets.length ? Math.round((completed.length / draft.sets.filter((s) => !draft.skipped.includes(s.exercise_id)).length) * 100) : 0;

  function finish() {
    setConfirm(false);
    const now = new Date().toISOString();
    const payload: WorkoutPayload = {
      id: draft.id, program_id: programId, training_day_id: day.id, name: day.name, performed_on: draft.performed_on,
      started_at: draft.started_at ?? now, finished_at: existing?.finished_at ?? now, status: "completed", notes: draft.notes.trim() || null, device_updated_at: now,
      sets: draft.sets.map((s) => ({
        exercise_id: s.exercise_id, prescription_set_id: s.prescription_set_id, exercise_position: s.exercise_position, position: s.position, set_type: s.set_type,
        reps: s.reps, weight_kg: s.weight_kg, rir: s.rir, is_completed: s.is_completed && !draft.skipped.includes(s.exercise_id),
        is_skipped: draft.skipped.includes(s.exercise_id), notes: null, completed_at: s.completed_at,
      })),
    };
    start(async () => {
      let ok = false;
      try {
        if (!navigator.onLine) throw new Error("offline");
        const r = await logWorkoutAction(payload);
        if (!r.ok) { toast(r.error, "error"); return; }
        ok = true;
      } catch {
        enqueue(payload);
        toast(t.workout.offline);
      }
      clearDraft(day.id);
      setRest(null);
      if (ok) { toast(t.workout.finished); router.push("/klijent/treninzi"); router.refresh(); }
      else setQueuedDone(true);
    });
  }

  const groups = day.exercises.map((e, ei) => ({ e, ei, sets: draft.sets.filter((s) => s.exercise_position === ei) }));
  const prs = useMemo(() => {
    const out = new Set<string>();
    for (const g of groups) {
      const prev = previous[g.e.exercise_id];
      if (!prev) continue;
      const before = bestE1RM(prev.sets.map((s) => ({ ...s, set_type: "working" as const, is_completed: true })));
      const now = bestE1RM(g.sets.filter((s) => s.is_completed));
      if (before && now && now > before) out.add(g.e.exercise_id);
    }
    return out;
  }, [groups, previous]);

  if (queuedDone) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success"><Check className="size-8" /></span>
        <h1 className="text-xl font-extrabold">{t.workout.finished}</h1>
        <p className="text-sm text-muted">{t.workout.savedOffline}</p>
        <Link href="/klijent/treninzi" className="font-semibold text-accent">{t.nav.client.workouts}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <Link href="/klijent/treninzi" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.nav.client.workouts}</Link>
      <div className="mb-4">
        <div className="text-[13px] font-semibold text-muted">{t.strength.week(weekNumber)}</div>
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">{day.name}</h1>
        {day.notes && <p className="mt-1 text-sm text-muted">{day.notes}</p>}
      </div>
      {finished && <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-sm font-semibold text-success"><Check className="size-4" />{t.workout.finished} {formatDate(existing!.performed_on)}</div>}

      <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-20 -mx-4 mb-4 bg-bg/90 px-4 py-2 backdrop-blur md:top-0">
        <div className="flex items-center justify-between text-[13px] font-semibold"><span className="text-muted">{completed.length} / {draft.sets.length} {t.workout.sets}</span><span className="tabular">{t.workout.volume}: {formatNumber(volume, 0)} kg</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} /></div>
      </div>

      <div className="grid gap-3">
        {groups.map(({ e, ei, sets }) => {
          const info = exMap.get(e.exercise_id);
          const skipped = draft.skipped.includes(e.exercise_id);
          const prev = previous[e.exercise_id];
          return (
            <section key={e.id} className={cn("rounded-[22px] border bg-surface p-4", skipped ? "border-dashed border-line-strong opacity-60" : "border-line", e.superset_group && "border-l-4 border-l-accent")}>
              <div className="mb-2 flex items-start gap-2">
                {e.superset_group && <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{e.superset_group}</span>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold leading-tight">{info?.name}</h2>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    {e.rest_seconds ? <span>{t.workout.rest} {Math.floor(e.rest_seconds / 60)}:{String(e.rest_seconds % 60).padStart(2, "0")}</span> : null}
                    {e.tempo && <span>{t.strength.tempo} {e.tempo}</span>}
                    {info?.media_url && <a href={info.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">Video <ExternalLink className="size-3" /></a>}
                  </div>
                </div>
                {prs.has(e.exercise_id) && <Badge tone="accent"><Trophy className="size-3.5" />{t.workout.pr}</Badge>}
                <button type="button" onClick={() => setDraft((d) => ({ ...d, skipped: skipped ? d.skipped.filter((x) => x !== e.exercise_id) : [...d.skipped, e.exercise_id] }))}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted hover:bg-hover" aria-pressed={skipped}>
                  <SkipForward className="size-3.5" />{skipped ? t.workout.skipped : t.workout.skip}
                </button>
              </div>
              {e.notes && <p className="mb-2 rounded-[12px] bg-subtle px-3 py-2 text-[13px] text-ink-2">{e.notes}</p>}
              {prev && <p className="mb-2 flex items-center gap-1.5 text-xs text-muted"><History className="size-3.5" />{t.workout.previous} ({formatDate(prev.date)}): {prev.sets.map((s) => `${s.reps ?? "–"}×${s.weight_kg != null ? formatNumber(s.weight_kg, 2) : "–"}`).join(", ")}</p>}
              {!skipped && (
                <div className="grid gap-1.5">
                  <div className="grid grid-cols-[26px_1fr_64px_72px_44px] items-center gap-1.5 text-[11px] font-semibold text-muted">
                    <span>#</span><span>{t.workout.planned}</span><span className="text-center">{t.strength.reps}</span><span className="text-center">kg</span><span />
                  </div>
                  {sets.map((s, i) => (
                    <div key={s.key} className={cn("grid grid-cols-[26px_1fr_64px_72px_44px] items-center gap-1.5 rounded-[12px] transition-colors", s.is_completed && "bg-success-soft/60")}>
                      <span className={cn("text-center text-xs font-bold tabular", s.set_type === "warmup" ? "text-faint" : "text-muted")}>{s.set_type === "warmup" ? "Z" : s.set_type === "dropset" ? "D" : i + 1 - sets.filter((x, j) => j < i && x.set_type === "warmup").length}</span>
                      <span className="truncate text-[13px] text-ink-2 tabular">{s.target ?? "–"}</span>
                      <NumCell label={t.strength.reps} value={s.reps} min={0} max={200} integer onChange={(v) => patch(s.key, { reps: v })} className="h-10" />
                      <NumCell label={t.strength.weight} value={s.weight_kg} min={0} max={500} step={0.25} onChange={(v) => patch(s.key, { weight_kg: v })} className="h-10" />
                      <button type="button" onClick={() => toggle(s, e.rest_seconds)} aria-pressed={s.is_completed} aria-label={t.workout.setDone}
                        className={cn("grid size-10 place-items-center rounded-[12px] border-2 transition-all active:scale-90", s.is_completed ? "border-success bg-success text-white" : "border-line-strong text-transparent hover:border-ink")}>
                        <Check className="size-5" strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setDraft((d) => {
                    const last = sets.at(-1);
                    return { ...d, sets: [...d.sets, { ...(last ?? { exercise_id: e.exercise_id, set_type: "working", reps: null, weight_kg: null, rir: null, target: null, prescription_set_id: null, exercise_position: ei }), key: crypto.randomUUID(), position: sets.length, prescription_set_id: null, target: null, is_completed: false, completed_at: null } as LogSet] };
                  })} className="mt-1 inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-accent hover:bg-accent-soft"><Plus className="size-3.5" />{t.workout.addSet}</button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-4 grid gap-1.5">
        <label htmlFor="w-notes" className="text-[13px] font-semibold">{t.workout.notes} <span className="font-normal text-faint">({t.common.optional})</span></label>
        <Textarea id="w-notes" rows={2} value={draft.notes} maxLength={2000} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-[248px]">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" variant="accent" className="w-full" loading={saving} onClick={() => (completed.length < draft.sets.length && !finished ? setConfirm(true) : finish())}>
            <Check className="size-5" />{finished ? t.common.saveChanges : t.workout.finish}
          </Button>
        </div>
      </div>

      <RestTimer rest={rest} onChange={setRest} />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t.workout.finish} description={t.workout.finishConfirm} confirmLabel={t.workout.finish} tone="primary" onConfirm={finish} loading={saving} />
    </div>
  );
}
