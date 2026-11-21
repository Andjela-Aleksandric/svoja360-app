"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRightLeft, Check, Clock, Dumbbell, ExternalLink, History, MoreHorizontal, Play, Plus, RotateCcw, SkipForward, Trash2, Trophy } from "lucide-react";
import type { ExerciseItem, PDay } from "@/lib/strength/types";
import type { ExerciseHistory, LoggedSet } from "@/lib/data/strength";
import { formatReps } from "@/lib/strength/types";
import { estimateOneRepMax, totalVolume } from "@/lib/utils/training";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateShort, formatNumber, todayISO } from "@/lib/utils/format";
import { formatDuration } from "@/lib/utils/running";
import { logWorkoutAction, type WorkoutPayload } from "@/app/actions/workouts";
import { clearDraft, enqueue, loadDraft, saveDraft } from "@/lib/strength/offline-queue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/trend-chart";
import { NumCell } from "./num-cell";
import { RestTimer, type RestState } from "./rest-timer";
import { ExercisePicker } from "./exercise-picker";

const W = t.workout;
type SetType = "warmup" | "working" | "dropset";
interface LogSet {
  key: string; exercise_id: string; prescription_set_id: string | null; exercise_position: number; position: number;
  set_type: SetType; target: string | null; reps: number | null; weight_kg: number | null; rir: number | null;
  is_completed: boolean; completed_at: string | null; phReps?: number | null; phWeight?: number | null;
}
interface Draft { id: string; started_at: string | null; performed_on: string; notes: string; sets: LogSet[]; skipped: string[]; updated: number; extras?: string[]; swaps?: Record<number, string> }
type Prev = Record<string, { date: string; sets: { reps: number | null; weight_kg: number | null }[] }>;

function fromPlan(day: PDay, previous: Prev): LogSet[] {
  return day.exercises.flatMap((e, ei) => {
    let wi = 0;
    return e.sets.map((s, si) => {
      const prevSet = s.set_type === "warmup" ? undefined : previous[e.exercise_id]?.sets[wi++];
      return {
        key: crypto.randomUUID(), exercise_id: e.exercise_id, prescription_set_id: s.id, exercise_position: ei, position: si, set_type: s.set_type,
        target: `${formatReps(s.reps_min, s.reps_max)}${s.weight_kg != null ? ` × ${formatNumber(s.weight_kg, 2)} kg` : ""}${s.rir != null ? ` · RIR ${formatNumber(s.rir)}` : ""}${s.rpe != null ? ` · RPE ${formatNumber(s.rpe)}` : ""}`,
        reps: null, weight_kg: null, rir: null, is_completed: false, completed_at: null,
        phReps: s.reps_max ?? s.reps_min ?? prevSet?.reps ?? null, phWeight: s.weight_kg ?? prevSet?.weight_kg ?? null,
      };
    });
  });
}

const blankSet = (exercise_id: string, exercise_position: number, position: number, from?: LogSet): LogSet => ({
  key: crypto.randomUUID(), exercise_id, prescription_set_id: null, exercise_position, position, set_type: from?.set_type === "warmup" ? "working" : from?.set_type ?? "working", target: null,
  reps: null, weight_kg: null, rir: null, is_completed: false, completed_at: null, phReps: from?.reps ?? from?.phReps ?? null, phWeight: from?.weight_kg ?? from?.phWeight ?? null,
});

export function WorkoutLogger({ programId, day, weekNumber, exercises, library, previous, history, existing }: {
  programId: string; day: PDay; weekNumber: number; exercises: { id: string; name: string; instructions: string | null; media_url: string | null; equipment: string }[];
  library: ExerciseItem[]; previous: Prev; history: Record<string, ExerciseHistory>;
  existing: { id: string; started_at: string | null; finished_at: string | null; status: string; notes: string | null; performed_on: string; sets: LoggedSet[] } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const exMap = useMemo(() => new Map<string, { name: string; instructions: string | null; media_url: string | null }>([...library.map((e) => [e.id, e] as const), ...exercises.map((e) => [e.id, e] as const)]), [exercises, library]);
  const [rest, setRest] = useState<RestState | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, start] = useTransition();
  const [queuedDone, setQueuedDone] = useState(false);
  const [summary, setSummary] = useState<null | { duration: number; volume: number; sets: number; prs: string[]; prevVolume: number }>(null);
  const [picker, setPicker] = useState<null | { mode: "add" } | { mode: "swap"; ei: number }>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const finished = existing?.status === "completed";

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) {
      const planned = fromPlan(day, previous);
      const extraIds = [...new Set(existing.sets.filter((s) => s.exercise_position >= day.exercises.length).sort((a, b) => a.exercise_position - b.exercise_position).map((s) => s.exercise_id))];
      const swaps: Record<number, string> = {};
      day.exercises.forEach((e, ei) => { const got = existing.sets.find((s) => s.exercise_position === ei); if (got && got.exercise_id !== e.exercise_id) swaps[ei] = got.exercise_id; });
      return {
        id: existing.id, started_at: existing.started_at, performed_on: existing.performed_on, notes: existing.notes ?? "", updated: Date.now(), extras: extraIds, swaps,
        skipped: [...new Set(existing.sets.filter((s) => s.is_skipped).map((s) => s.exercise_id))],
        sets: existing.sets.map((s) => ({ key: crypto.randomUUID(), exercise_id: s.exercise_id, prescription_set_id: null, exercise_position: s.exercise_position, position: s.position, set_type: s.set_type,
          target: planned.find((p) => p.exercise_position === s.exercise_position && p.position === s.position)?.target ?? null,
          reps: s.reps, weight_kg: s.weight_kg, rir: s.rir, is_completed: s.is_completed, completed_at: null })),
      };
    }
    return { id: crypto.randomUUID(), started_at: null, performed_on: todayISO(), notes: "", sets: fromPlan(day, previous), skipped: [], updated: Date.now(), extras: [], swaps: {} };
  });

  // Restore an unfinished workout from this device.
  useEffect(() => {
    if (finished) return;
    const saved = loadDraft<Draft>(day.id);
    if (saved && saved.sets?.length) setDraft({ extras: [], swaps: {}, ...saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!finished && draft.started_at) saveDraft(day.id, draft); }, [draft, day.id, finished]);
  useEffect(() => {
    if (!draft.started_at || finished) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [draft.started_at, finished]);

  const patch = useCallback((key: string, p: Partial<LogSet>) => setDraft((d) => ({ ...d, updated: Date.now(), sets: d.sets.map((s) => (s.key === key ? { ...s, ...p } : s)) })), []);
  const begin = () => setDraft((d) => ({ ...d, started_at: d.started_at ?? new Date().toISOString() }));

  function toggle(s: LogSet, restSeconds: number | null) {
    const done = !s.is_completed;
    setDraft((d) => ({ ...d, started_at: d.started_at ?? new Date().toISOString(), updated: Date.now(), sets: d.sets.map((x) => (x.key === s.key ? {
      ...x, is_completed: done, completed_at: done ? new Date().toISOString() : null,
      reps: done && x.reps == null ? x.phReps ?? null : x.reps, weight_kg: done && x.weight_kg == null ? x.phWeight ?? null : x.weight_kg,
    } : x)) }));
    if (done && s.set_type !== "warmup") { const sec = restSeconds ?? 90; setRest({ endsAt: Date.now() + sec * 1000, total: sec }); }
  }

  // Groups: planned exercises (possibly swapped) + exercises added during the workout.
  const groups = useMemo(() => {
    const planned = day.exercises.map((e, ei) => ({ ei, exercise_id: draft.swaps?.[ei] ?? e.exercise_id, plan: e, swapped: !!draft.swaps?.[ei] }));
    const extra = (draft.extras ?? []).map((id, k) => ({ ei: day.exercises.length + k, exercise_id: id, plan: null, swapped: false }));
    return [...planned, ...extra].map((g) => ({ ...g, sets: draft.sets.filter((s) => s.exercise_position === g.ei) }));
  }, [day.exercises, draft.swaps, draft.extras, draft.sets]);

  const isSkipped = (id: string) => draft.skipped.includes(id);
  const completed = draft.sets.filter((s) => s.is_completed && !isSkipped(s.exercise_id));
  const volume = totalVolume(completed);
  const activeSets = draft.sets.filter((s) => !isSkipped(s.exercise_id));
  const progress = activeSets.length ? Math.round((completed.length / activeSets.length) * 100) : 0;
  const elapsed = draft.started_at ? Math.max(0, Math.floor(((finished && existing?.finished_at ? Date.parse(existing.finished_at) : now) - Date.parse(draft.started_at)) / 1000)) : 0;

  const isPR = (s: LogSet) => {
    if (!s.is_completed || s.set_type === "warmup") return false;
    const h = history[s.exercise_id];
    if (!h || (h.bestE1RM == null && h.bestWeight == null)) return false;
    const e = estimateOneRepMax(s.weight_kg, s.reps);
    return (e != null && h.bestE1RM != null && e > h.bestE1RM) || (s.weight_kg != null && h.bestWeight != null && s.weight_kg > h.bestWeight);
  };
  const prExercises = [...new Set(completed.filter(isPR).map((s) => s.exercise_id))];

  function finish() {
    setConfirm(false);
    const nowIso = new Date().toISOString();
    const payload: WorkoutPayload = {
      id: draft.id, program_id: programId, training_day_id: day.id, name: day.name, performed_on: draft.performed_on,
      started_at: draft.started_at ?? nowIso, finished_at: existing?.finished_at ?? nowIso, status: "completed", notes: draft.notes.trim() || null, device_updated_at: nowIso,
      sets: draft.sets.map((s) => ({
        exercise_id: s.exercise_id, prescription_set_id: s.prescription_set_id, exercise_position: s.exercise_position, position: s.position, set_type: s.set_type,
        reps: s.reps, weight_kg: s.weight_kg, rir: s.rir, is_completed: s.is_completed && !isSkipped(s.exercise_id),
        is_skipped: isSkipped(s.exercise_id), notes: null, completed_at: s.completed_at,
      })),
    };
    const prevVolume = groups.reduce((a, g) => a + (previous[g.exercise_id]?.sets ?? []).reduce((b, x) => b + (x.weight_kg ?? 0) * (x.reps ?? 0), 0), 0);
    const result = { duration: elapsed, volume, sets: completed.filter((s) => s.set_type !== "warmup").length, prs: prExercises.map((id) => exMap.get(id)?.name ?? ""), prevVolume };
    start(async () => {
      let ok = false;
      try {
        if (!navigator.onLine) throw new Error("offline");
        const r = await logWorkoutAction(payload);
        if (!r.ok) { toast(r.error, "error"); return; }
        ok = true;
      } catch {
        enqueue(payload);
        toast(W.offline);
      }
      clearDraft(day.id);
      setRest(null);
      if (ok) { if (finished) { toast(t.common.saved); router.push("/klijent/treninzi"); router.refresh(); } else setSummary(result); }
      else setQueuedDone(true);
    });
  }

  const removeGroupSet = (key: string, ei: number) => setDraft((d) => {
    const rest = d.sets.filter((x) => x.key !== key);
    let pos = 0;
    return { ...d, sets: rest.map((x) => (x.exercise_position === ei ? { ...x, position: pos++ } : x)) };
  });

  if (summary) return <Summary s={summary} dayName={day.name} onDone={() => { router.push("/klijent/treninzi"); router.refresh(); }} />;
  if (queuedDone) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-mint-soft text-mint-ink"><Check className="size-8" /></span>
        <h1 className="text-xl font-extrabold">{W.finished}</h1>
        <p className="text-sm text-muted">{W.savedOffline}</p>
        <Link href="/klijent/treninzi" className="font-semibold text-accent">{t.nav.client.workouts}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-32">
      <Link href="/klijent/treninzi" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.nav.client.workouts}</Link>
      <div className="mb-4">
        <div className="eyebrow eyebrow-line mb-2">{t.strength.week(weekNumber)}</div>
        <h1 className="font-display text-[38px] leading-[1.05] sm:text-[46px]">{day.name}</h1>
        {day.notes && <p className="mt-1.5 text-[15px] text-muted">{day.notes}</p>}
      </div>
      {finished && <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-mint-soft px-4 py-3 text-sm font-semibold text-mint-ink"><Check className="size-4" />{W.finished} {formatDate(existing!.performed_on)}</div>}

      {/* Live stats */}
      <div className="sticky top-[calc(56px+env(safe-area-inset-top))] z-20 -mx-4 mb-4 px-4 py-2 md:top-2">
        <div className="band overflow-hidden rounded-[20px] px-4 py-3 shadow-[0_18px_40px_-28px_rgba(14,12,16,0.9)]">
          <div className="grid grid-cols-3 items-center gap-2">
            <Stat label={W.elapsed} value={draft.started_at ? formatDuration(elapsed) || "0:00" : "–"} icon={<Clock className="size-3.5" />} />
            <Stat label={W.volume} value={`${formatNumber(volume, 0)} kg`} />
            <Stat label={W.setsDone} value={`${completed.length}/${activeSets.length}`} />
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-band-line"><motion.div className="h-full rounded-full bg-mint" animate={{ width: `${progress}%` }} /></div>
        </div>
        {!draft.started_at && !finished && (
          <Button variant="mint" className="mt-2 w-full" onClick={begin}><Play className="size-4" />{W.startNow}</Button>
        )}
      </div>

      <div className="grid gap-3">
        {groups.map((g) => {
          const info = exMap.get(g.exercise_id);
          const skipped = isSkipped(g.exercise_id);
          const prev = previous[g.exercise_id];
          const e = g.plan;
          let wi = 0;
          return (
            <section key={g.ei} className={cn("rounded-[22px] border bg-surface p-4 transition-colors", skipped ? "border-dashed border-line-strong opacity-60" : "border-line", e?.superset_group && "border-l-4 border-l-accent")}>
              <div className="mb-2 flex items-start gap-2">
                {e?.superset_group && <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{e.superset_group}</span>}
                <button type="button" onClick={() => setSheet(g.exercise_id)} className="group/ex min-w-0 flex-1 text-left">
                  <h2 className="text-[17px] font-bold leading-tight text-accent transition-colors group-hover/ex:text-ink">{info?.name ?? "…"}</h2>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                    {e?.rest_seconds ? <span>{W.rest} {formatDuration(e.rest_seconds)}</span> : null}
                    {e?.tempo && <span>{t.strength.tempo} {e.tempo}</span>}
                    {!e && <span className="font-semibold text-mint-ink">{W.extra}</span>}
                    {g.swapped && <span className="font-semibold text-mint-ink">{W.swapExercise}</span>}
                    <span className="inline-flex items-center gap-1"><History className="size-3" />{W.exHistory}</span>
                  </div>
                </button>
                {prExercises.includes(g.exercise_id) && <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex h-7 items-center gap-1 rounded-full bg-[#fff2cc] px-2.5 text-xs font-bold text-[#8a5a00]"><Trophy className="size-3.5" />{W.prShort}</motion.span>}
                <Dropdown>
                  <DropdownTrigger asChild><button type="button" aria-label={t.common.actions} className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"><MoreHorizontal className="size-4" /></button></DropdownTrigger>
                  <DropdownContent>
                    <DropdownItem onSelect={() => setSheet(g.exercise_id)}><History />{W.exHistory}</DropdownItem>
                    {e && <DropdownItem onSelect={() => setPicker({ mode: "swap", ei: g.ei })}><ArrowRightLeft />{W.swapExercise}</DropdownItem>}
                    <DropdownItem onSelect={() => setDraft((d) => ({ ...d, skipped: skipped ? d.skipped.filter((x) => x !== g.exercise_id) : [...d.skipped, g.exercise_id] }))}>{skipped ? <RotateCcw /> : <SkipForward />}{skipped ? W.unskip : W.skip}</DropdownItem>
                    {!e && <><DropdownSeparator /><DropdownItem danger onSelect={() => setDraft((d) => {
                      const k = g.ei - day.exercises.length;
                      const extras = (d.extras ?? []).filter((_, i) => i !== k);
                      return { ...d, extras, sets: d.sets.filter((s) => s.exercise_position !== g.ei).map((s) => (s.exercise_position > g.ei ? { ...s, exercise_position: s.exercise_position - 1 } : s)) };
                    })}><Trash2 />{t.common.remove}</DropdownItem></>}
                  </DropdownContent>
                </Dropdown>
              </div>
              {e?.notes && <p className="mb-2 rounded-[12px] bg-accent-soft/50 px-3 py-2 text-[13.5px] text-ink-2">{e.notes}</p>}
              {e && e.sets.length > 0 && <p className="mb-2 text-[12.5px] text-muted"><b className="text-ink-2">{W.planLine}:</b> {e.sets.filter((s) => s.set_type !== "warmup").length}× {formatReps(e.sets.find((s) => s.set_type !== "warmup")?.reps_min ?? null, e.sets.find((s) => s.set_type !== "warmup")?.reps_max ?? null)}{e.sets.find((s) => s.rir != null)?.rir != null ? ` · RIR ${e.sets.find((s) => s.rir != null)!.rir}` : ""}</p>}
              {!skipped && (
                <div className="grid gap-1">
                  <div className="grid grid-cols-[38px_1fr_76px_64px_44px] items-center gap-1.5 px-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                    <span className="text-center">{W.colSet}</span><span>{W.colPrev}</span><span className="text-center">kg</span><span className="text-center">{W.reps}</span><span />
                  </div>
                  {g.sets.map((s) => {
                    const label = s.set_type === "warmup" ? "W" : s.set_type === "dropset" ? "D" : String(++wi);
                    const p = s.set_type === "warmup" ? undefined : prev?.sets[wi - 1];
                    const pr = isPR(s);
                    return (
                      <motion.div key={s.key} layout className={cn("grid grid-cols-[38px_1fr_76px_64px_44px] items-center gap-1.5 rounded-[12px] px-0.5 py-0.5 transition-colors", s.is_completed && (pr ? "bg-[#fff2cc]" : "bg-mint-soft"))}>
                        <Dropdown>
                          <DropdownTrigger asChild>
                            <button type="button" aria-label={W.setType} className={cn("grid h-9 place-items-center rounded-[10px] text-[13px] font-bold tabular transition-colors hover:bg-hover", s.set_type === "warmup" ? "text-[#b7791f]" : s.set_type === "dropset" ? "text-accent" : "text-ink")}>
                              {pr ? <Trophy className="size-4 text-[#b7791f]" /> : label}
                            </button>
                          </DropdownTrigger>
                          <DropdownContent align="start">
                            {(["warmup", "working", "dropset"] as SetType[]).map((ty) => (
                              <DropdownItem key={ty} onSelect={() => patch(s.key, { set_type: ty })}><span className="grid w-4 place-items-center font-bold">{ty === "warmup" ? "W" : ty === "dropset" ? "D" : "1"}</span>{ty === "warmup" ? W.typeWarmup : ty === "dropset" ? W.typeDropset : W.typeWorking}{s.set_type === ty && <Check className="ml-auto" />}</DropdownItem>
                            ))}
                            <DropdownSeparator />
                            <DropdownItem danger onSelect={() => removeGroupSet(s.key, g.ei)}><Trash2 />{W.removeSet}</DropdownItem>
                          </DropdownContent>
                        </Dropdown>
                        <button type="button" disabled={!p} title={p ? W.tapPrev : undefined} onClick={() => p && patch(s.key, { weight_kg: p.weight_kg, reps: p.reps })}
                          className="truncate rounded-[8px] px-1 py-1 text-left text-[13px] text-muted tabular transition-colors enabled:hover:bg-hover enabled:hover:text-ink">
                          {p ? `${p.weight_kg != null ? formatNumber(p.weight_kg, 2) : "–"} kg × ${p.reps ?? "–"}` : s.target ?? "–"}
                        </button>
                        <NumCell label={t.strength.weight} value={s.weight_kg} placeholder={s.phWeight != null ? formatNumber(s.phWeight, 2) : "kg"} min={0} max={500} step={0.25} onChange={(v) => patch(s.key, { weight_kg: v })} className={cn("h-10 placeholder:text-faint", s.is_completed && "border-transparent bg-transparent")} />
                        <NumCell label={t.strength.reps} value={s.reps} placeholder={s.phReps != null ? String(s.phReps) : "0"} min={0} max={200} integer onChange={(v) => patch(s.key, { reps: v })} className={cn("h-10 placeholder:text-faint", s.is_completed && "border-transparent bg-transparent")} />
                        <button type="button" onClick={() => toggle(s, e?.rest_seconds ?? null)} aria-pressed={s.is_completed} aria-label={W.setDone}
                          className={cn("grid size-10 place-items-center rounded-[12px] border-2 transition-all active:scale-90", s.is_completed ? "animate-pop border-mint-ink bg-mint-ink text-white" : "border-line-strong text-transparent hover:border-ink hover:text-faint")}>
                          <Check className="size-5" strokeWidth={3} />
                        </button>
                      </motion.div>
                    );
                  })}
                  <button type="button" onClick={() => setDraft((d) => ({ ...d, sets: [...d.sets, blankSet(g.exercise_id, g.ei, g.sets.length, g.sets.at(-1))] }))}
                    className="mt-1 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-subtle text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-hover hover:text-ink"><Plus className="size-4" />{W.addSet}</button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={() => setPicker({ mode: "add" })}><Plus className="size-4" />{W.addExercise}</Button>

      <div className="mt-4 grid gap-1.5">
        <label htmlFor="w-notes" className="text-[13px] font-semibold">{W.notes} <span className="font-normal text-faint">({t.common.optional})</span></label>
        <Textarea id="w-notes" rows={2} value={draft.notes} maxLength={2000} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-[var(--sidebar-w,256px)]">
        <div className="mx-auto max-w-2xl">
          <Button size="lg" variant="accent" className="w-full" loading={saving} onClick={() => (completed.length < activeSets.length && !finished ? setConfirm(true) : finish())}>
            <Check className="size-5" />{finished ? t.common.saveChanges : W.finish}
          </Button>
        </div>
      </div>

      <RestTimer rest={rest} onChange={setRest} />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={W.finish} description={W.finishConfirm} confirmLabel={W.finish} tone="primary" onConfirm={finish} loading={saving} />
      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} exercises={library} onPick={(ex) => {
        if (!picker) return;
        if (picker.mode === "add") {
          setDraft((d) => {
            const ei = day.exercises.length + (d.extras ?? []).length;
            return { ...d, started_at: d.started_at ?? new Date().toISOString(), extras: [...(d.extras ?? []), ex.id], sets: [...d.sets, ...[0, 1, 2].map((i) => blankSet(ex.id, ei, i))] };
          });
        } else {
          const ei = picker.ei;
          setDraft((d) => ({ ...d, swaps: { ...(d.swaps ?? {}), [ei]: ex.id }, sets: d.sets.map((s) => (s.exercise_position === ei ? { ...s, exercise_id: ex.id, phWeight: null, weight_kg: s.is_completed ? s.weight_kg : null } : s)) }));
        }
        setPicker(null);
      }} />
      <ExerciseSheet id={sheet} onClose={() => setSheet(null)} info={sheet ? exMap.get(sheet) : undefined} h={sheet ? history[sheet] : undefined} />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 text-center">
      <div className="eyebrow flex items-center justify-center gap-1 text-[9.5px] text-band-muted">{icon}{label}</div>
      <div className="mt-0.5 truncate font-display text-[24px] leading-none tabular">{value}</div>
    </div>
  );
}

function ExerciseSheet({ id, onClose, info, h }: { id: string | null; onClose: () => void; info?: { name: string; instructions: string | null; media_url: string | null }; h?: ExerciseHistory }) {
  const series = (h?.sessions ?? []).map((s) => ({ date: s.date, value: s.sets.reduce<number | null>((b, x) => { const e = x.set_type === "warmup" ? null : estimateOneRepMax(x.weight_kg, x.reps); return e != null && (b == null || e > b) ? e : b; }, null) })).filter((p) => p.value != null).reverse();
  return (
    <Modal open={!!id} onOpenChange={(o) => !o && onClose()} title={info?.name ?? ""} size="lg">
      <div className="grid gap-4">
        {h ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="band rounded-[16px] p-3.5"><div className="eyebrow text-[9.5px] text-mint">{t.workout.bestE1rm}</div><div className="mt-1 font-display text-[30px] leading-none tabular">{h.bestE1RM != null ? `${formatNumber(h.bestE1RM, 1)} kg` : "–"}</div></div>
              <div className="rounded-[16px] border border-line p-3.5"><div className="eyebrow text-[9.5px]">{t.workout.bestWeight}</div><div className="mt-1 font-display text-[30px] leading-none tabular">{h.bestWeight != null ? `${formatNumber(h.bestWeight, 2)} kg` : "–"}</div></div>
            </div>
            {series.length > 1 && <TrendChart data={series as { date: string; value: number }[]} unit="kg" ariaLabel={t.workout.bestE1rm} height={150} />}
            <div>
              <div className="eyebrow mb-2 text-[10px]">{t.workout.lastSessions}</div>
              <ul className="grid gap-1.5">
                {h.sessions.map((s) => (
                  <li key={s.date + s.sets.length} className="rounded-[12px] bg-subtle px-3 py-2 text-[13.5px]">
                    <div className="font-semibold tabular">{formatDateShort(s.date)}</div>
                    <div className="text-ink-2 tabular">{s.sets.filter((x) => x.set_type !== "warmup").map((x) => `${x.weight_kg != null ? formatNumber(x.weight_kg, 2) : "–"}×${x.reps ?? "–"}`).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : <p className="flex items-center gap-2 rounded-[14px] bg-mint-soft px-4 py-3 text-sm text-mint-ink"><Dumbbell className="size-4" />{t.workout.noExerciseHistory}</p>}
        {(info?.instructions || info?.media_url) && (
          <div>
            <div className="eyebrow mb-2 text-[10px]">{t.workout.instructions}</div>
            {info?.instructions && <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink-2">{info.instructions}</p>}
            {info?.media_url && <a href={info.media_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent">Video <ExternalLink className="size-3.5" /></a>}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Summary({ s, dayName, onDone }: { s: { duration: number; volume: number; sets: number; prs: string[]; prevVolume: number }; dayName: string; onDone: () => void }) {
  const diff = s.prevVolume > 0 ? Math.round(((s.volume - s.prevVolume) / s.prevVolume) * 100) : null;
  return (
    <div className="mx-auto grid max-w-lg gap-5 py-6 text-center">
      <motion.span initial={{ scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto grid size-20 place-items-center rounded-full bg-mint text-ink shadow-[0_20px_40px_-20px_rgba(29,107,80,0.8)]"><Check className="size-10" strokeWidth={3} /></motion.span>
      <div>
        <div className="eyebrow mb-2">{dayName}</div>
        <h1 className="font-display text-[40px] leading-[1.05]">{t.workout.summaryTitle}</h1>
      </div>
      <div className="band grid grid-cols-3 gap-2 rounded-[22px] p-5">
        <Stat label={t.workout.elapsed} value={formatDuration(s.duration) || "–"} />
        <Stat label={t.workout.volume} value={`${formatNumber(s.volume, 0)} kg`} />
        <Stat label={t.workout.setsDone} value={String(s.sets)} />
      </div>
      {diff != null && <p className={cn("text-[15px] font-semibold", diff >= 0 ? "text-mint-ink" : "text-muted")}>{t.workout.vsLast(`${diff > 0 ? "+" : ""}${diff}%`)}</p>}
      {s.prs.length > 0 && (
        <div className="rounded-[22px] border-[1.5px] border-[#f0c75e] bg-[#fff8e1] p-4 text-left">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#8a5a00]"><Trophy className="size-5" />{t.workout.summaryPrs(s.prs.length)}</div>
          <ul className="grid gap-1 text-[14.5px]">{s.prs.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      <Button size="lg" onClick={onDone}>{t.workout.doneBtn}</Button>
    </div>
  );
}
