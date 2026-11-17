"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Save, Trash2, X, CopyPlus, Play, CheckCircle2, Archive, LayoutTemplate } from "lucide-react";
import type { ExerciseItem, PDay, PExercise, ProgramTree, PSet, PWeek, SetType } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { copyProgramAction, deleteProgramAction, saveProgramAction, setProgramStatusAction } from "@/app/trener/trening/actions";
import { ExercisePicker } from "./exercise-picker";
import { NumCell } from "./num-cell";

const uid = () => crypto.randomUUID();
const statusTone = { draft: "neutral", active: "success", completed: "info", archived: "outline" } as const;
const SUPERSETS = ["A", "B", "C", "D", "E", "F"];

function renumber(tree: ProgramTree): ProgramTree {
  return {
    ...tree,
    weeks: tree.weeks.map((w, wi) => ({
      ...w, week_number: wi + 1,
      days: w.days.map((d, di) => ({ ...d, position: di, exercises: d.exercises.map((e, ei) => ({ ...e, position: ei, sets: e.sets.map((s, si) => ({ ...s, position: si })) })) })),
    })),
  };
}

function cloneDay(d: PDay): PDay {
  return { ...d, id: uid(), exercises: d.exercises.map((e) => ({ ...e, id: uid(), sets: e.sets.map((s) => ({ ...s, id: uid() })) })) };
}

export function ProgramBuilder({ initial, exercises, clients, clientName }: { initial: ProgramTree; exercises: ExerciseItem[]; clients: { id: string; full_name: string }[]; clientName: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tree, setTree] = useState<ProgramTree>(initial);
  const [dirty, setDirty] = useState(false);
  const [weekIdx, setWeekIdx] = useState(0);
  const [picker, setPicker] = useState<{ dayId: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [progOpen, setProgOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const week = tree.weeks[Math.min(weekIdx, tree.weeks.length - 1)];

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (fn: (t: ProgramTree) => ProgramTree) => { setTree((cur) => renumber(fn(cur))); setDirty(true); };
  const updWeek = (wid: string, fn: (w: PWeek) => PWeek) => update((tr) => ({ ...tr, weeks: tr.weeks.map((w) => (w.id === wid ? fn(w) : w)) }));
  const updDay = (did: string, fn: (d: PDay) => PDay) => updWeek(week.id, (w) => ({ ...w, days: w.days.map((d) => (d.id === did ? fn(d) : d)) }));
  const updEx = (did: string, eid: string, fn: (e: PExercise) => PExercise) => updDay(did, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === eid ? fn(e) : e)) }));
  const updSet = (did: string, eid: string, sid: string, patch: Partial<PSet>) => updEx(did, eid, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));

  const save = () => startSave(async () => {
    const clean = { ...tree, weeks: tree.weeks.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d, name: d.name.trim() || "Trening", exercises: d.exercises.map((e) => ({ ...e, tempo: e.tempo && e.tempo.length === 4 ? e.tempo : null })) })) })) };
    const res = await saveProgramAction(clean);
    if (res.ok) { setDirty(false); toast(t.strength.saved); router.refresh(); } else toast(res.error, "error");
  });

  const setStatus = (status: ProgramTree["status"], msg: string) => startBusy(async () => {
    if (dirty) { const r = await saveProgramAction(tree); if (!r.ok) { toast(r.error, "error"); return; } setDirty(false); }
    const res = await setProgramStatusAction(tree.id, status);
    if (res.ok) { setTree((x) => ({ ...x, status })); toast(msg); router.refresh(); } else toast(res.error, "error");
  });

  const addWeek = () => {
    update((tr) => ({ ...tr, weeks: [...tr.weeks, { id: uid(), week_number: tr.weeks.length + 1, is_deload: false, notes: null, days: [] }] }));
    setWeekIdx(tree.weeks.length);
  };

  function copyToNextWeek(kg: number, reps: number) {
    update((tr) => {
      const i = tr.weeks.findIndex((w) => w.id === week.id);
      const src = tr.weeks[i];
      const bump = (d: PDay): PDay => {
        const c = cloneDay(d);
        return { ...c, exercises: c.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => s.set_type === "warmup" ? s : ({
          ...s,
          weight_kg: s.weight_kg != null && kg ? Number((s.weight_kg + kg).toFixed(2)) : s.weight_kg,
          reps_min: s.reps_min != null && reps ? s.reps_min + reps : s.reps_min,
          reps_max: s.reps_max != null && reps ? s.reps_max + reps : s.reps_max,
        })) })) };
      };
      const next = tr.weeks[i + 1];
      const newWeek: PWeek = { id: next?.id ?? uid(), week_number: i + 2, is_deload: next?.is_deload ?? false, notes: next?.notes ?? null, days: src.days.map(bump) };
      const weeks = [...tr.weeks];
      if (next) weeks[i + 1] = newWeek; else weeks.push(newWeek);
      return { ...tr, weeks };
    });
    setWeekIdx(weekIdx + 1);
    setProgOpen(false);
  }

  const addExercise = (dayId: string, ex: ExerciseItem) => updDay(dayId, (d) => ({
    ...d,
    exercises: [...d.exercises, {
      id: uid(), exercise_id: ex.id, position: d.exercises.length, superset_group: null,
      rest_seconds: ex.exercise_type === "compound" ? 120 : 75, tempo: null, notes: null,
      sets: Array.from({ length: 3 }, (_, i) => ({ id: uid(), position: i, set_type: "working" as SetType, reps_min: 8, reps_max: 10, weight_kg: null, rir: 2, rpe: null })),
    }],
  }));

  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted">
            <Badge tone={statusTone[tree.status]}>{t.strength.status[tree.status]}</Badge>
            {clientName ?? t.strength.noClient}
          </div>
          <input aria-label={t.strength.programName} value={tree.name} maxLength={120} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))}
            className="w-full rounded-[10px] bg-transparent text-[26px] font-extrabold tracking-[-0.02em] outline-none focus:bg-surface sm:text-[30px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tree.client_id && tree.status !== "active" && <Button variant="accent" onClick={() => setStatus("active", t.strength.activated)} loading={busy}><Play className="size-4" />{t.strength.activate}</Button>}
          <Dropdown>
            <DropdownTrigger asChild><Button variant="secondary" size="icon" aria-label={t.common.actions}><MoreHorizontal className="size-4" /></Button></DropdownTrigger>
            <DropdownContent>
              {tree.status === "active" && <DropdownItem onSelect={() => setStatus("completed", t.common.saved)}><CheckCircle2 />{t.strength.complete}</DropdownItem>}
              <DropdownItem onSelect={() => setCopyOpen(true)}><CopyPlus />{t.strength.duplicate}</DropdownItem>
              {tree.status !== "archived" ? <DropdownItem onSelect={() => setStatus("archived", t.common.saved)}><Archive />{t.common.archive}</DropdownItem>
                : <DropdownItem onSelect={() => setStatus("draft", t.common.saved)}><LayoutTemplate />{t.common.restore}</DropdownItem>}
              <DropdownSeparator />
              <DropdownItem danger onSelect={() => setDeleteOpen(true)}><Trash2 />{t.common.delete}</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <div className="mb-5 grid gap-4 rounded-[20px] border border-line bg-surface p-4 sm:grid-cols-[180px_1fr] sm:p-5">
        <Field label={t.strength.startDate} htmlFor="start_date"><Input id="start_date" type="date" value={tree.start_date ?? ""} onChange={(e) => update((x) => ({ ...x, start_date: e.target.value || null }))} /></Field>
        <Field label={t.common.description} htmlFor="desc" optional><Textarea id="desc" rows={1} value={tree.description ?? ""} onChange={(e) => update((x) => ({ ...x, description: e.target.value || null }))} maxLength={2000} className="min-h-11" /></Field>
      </div>

      {/* Weeks */}
      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {tree.weeks.map((w, i) => (
          <button key={w.id} role="tab" aria-selected={i === weekIdx} onClick={() => setWeekIdx(i)}
            className={cn("relative h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors", i === weekIdx ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>
            {t.strength.week(w.week_number)}{w.is_deload && <span className="ml-1.5 text-[11px] opacity-70">↓</span>}
          </button>
        ))}
        <button onClick={addWeek} disabled={tree.weeks.length >= 52} className="grid size-10 shrink-0 place-items-center rounded-full text-muted ring-1 ring-dashed ring-line-strong hover:text-ink" aria-label={t.strength.addWeek} title={t.strength.addWeek}><Plus className="size-4" /></button>
      </div>

      {week && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-surface px-3.5 text-sm font-semibold ring-1 ring-line">
            <input type="checkbox" checked={week.is_deload} onChange={(e) => updWeek(week.id, (w) => ({ ...w, is_deload: e.target.checked }))} className="size-4 accent-[var(--color-accent)]" />
            {t.strength.deload}
          </label>
          <Button size="sm" variant="secondary" onClick={() => setProgOpen(true)} disabled={!week.days.length}><Copy className="size-4" />{t.strength.copyNextWeek}</Button>
          {tree.weeks.length > 1 && <Button size="sm" variant="ghost" onClick={() => { update((x) => ({ ...x, weeks: x.weeks.filter((w) => w.id !== week.id) })); setWeekIdx(Math.max(0, weekIdx - 1)); }}><Trash2 className="size-4" />{t.strength.removeWeek}</Button>}
        </div>
      )}

      <div className="grid gap-4">
        <AnimatePresence initial={false}>
          {week?.days.map((d, di) => (
            <motion.section key={d.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="rounded-[22px] border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
                <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-bold text-white">{di + 1}</span>
                <input aria-label={t.strength.dayName} value={d.name} maxLength={80} onChange={(e) => updDay(d.id, (x) => ({ ...x, name: e.target.value }))}
                  className="min-w-0 flex-1 rounded-[8px] bg-transparent px-1 py-1 text-[16px] font-bold outline-none focus:bg-subtle" />
                <NativeSelect aria-label={t.strength.dayOfWeek} value={d.day_of_week ?? ""} onChange={(e) => updDay(d.id, (x) => ({ ...x, day_of_week: e.target.value ? Number(e.target.value) : null }))} className="h-9 w-auto text-sm">
                  <option value="">{t.strength.noDayOfWeek}</option>
                  {t.weekdays.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
                </NativeSelect>
                <Button variant="ghost" size="icon-sm" aria-label={t.strength.copyDay} title={t.strength.copyDay} onClick={() => updWeek(week.id, (w) => ({ ...w, days: [...w.days.slice(0, di + 1), { ...cloneDay(d), name: `${d.name} (2)` }, ...w.days.slice(di + 1)] }))} disabled={week.days.length >= 7}><Copy /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveUp} onClick={() => updWeek(week.id, (w) => ({ ...w, days: move(w.days, di, -1) }))} disabled={di === 0}><ArrowUp /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveDown} onClick={() => updWeek(week.id, (w) => ({ ...w, days: move(w.days, di, 1) }))} disabled={di === week.days.length - 1}><ArrowDown /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={t.strength.removeDay} onClick={() => updWeek(week.id, (w) => ({ ...w, days: w.days.filter((x) => x.id !== d.id) }))}><Trash2 /></Button>
              </div>

              <div className="grid gap-3 p-3 sm:p-4">
                {d.exercises.length === 0 && <p className="px-1 py-2 text-sm text-muted">{t.strength.noExercises}</p>}
                {d.exercises.map((e, ei) => {
                  const ex = exMap.get(e.exercise_id);
                  return (
                    <div key={e.id} className={cn("rounded-[16px] border border-line p-3", e.superset_group && "border-l-4 border-l-accent")}>
                      <div className="mb-2.5 flex items-start gap-2">
                        {e.superset_group && <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">{e.superset_group}</span>}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold leading-tight">{ex?.name ?? "–"}</div>
                          <div className="truncate text-xs text-muted">{ex?.muscles.filter((m) => m.is_primary).map((m) => m.name).join(", ")}</div>
                        </div>
                        <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveUp} onClick={() => updDay(d.id, (x) => ({ ...x, exercises: move(x.exercises, ei, -1) }))} disabled={ei === 0}><ArrowUp /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveDown} onClick={() => updDay(d.id, (x) => ({ ...x, exercises: move(x.exercises, ei, 1) }))} disabled={ei === d.exercises.length - 1}><ArrowDown /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label={t.strength.removeExercise} onClick={() => updDay(d.id, (x) => ({ ...x, exercises: x.exercises.filter((y) => y.id !== e.id) }))}><X /></Button>
                      </div>

                      <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-[110px_110px_110px_1fr]">
                        <label className="grid gap-1 text-[11px] font-semibold text-muted">{t.strength.superset}
                          <NativeSelect value={e.superset_group ?? ""} onChange={(v) => updEx(d.id, e.id, (x) => ({ ...x, superset_group: v.target.value || null }))} className="h-9 text-sm">
                            <option value="">–</option>{SUPERSETS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </NativeSelect>
                        </label>
                        <label className="grid gap-1 text-[11px] font-semibold text-muted">{t.strength.rest} ({t.strength.restSec})
                          <NumCell label={t.strength.rest} value={e.rest_seconds} min={0} max={900} integer onChange={(v) => updEx(d.id, e.id, (x) => ({ ...x, rest_seconds: v }))} />
                        </label>
                        <label className="grid gap-1 text-[11px] font-semibold text-muted" title={t.strength.tempoHelp}>{t.strength.tempo}
                          <input value={e.tempo ?? ""} maxLength={4} placeholder="3010" onChange={(v) => { const val = v.target.value.toUpperCase().replace(/[^0-9X]/g, ""); updEx(d.id, e.id, (x) => ({ ...x, tempo: val.length === 4 ? val : val ? val : null })); }}
                            aria-invalid={!!e.tempo && e.tempo.length !== 4} className="h-9 w-full rounded-[10px] border border-line bg-surface px-2 text-center text-sm font-semibold tabular outline-none focus:border-ink aria-[invalid=true]:border-danger" />
                        </label>
                        <label className="col-span-3 grid gap-1 text-[11px] font-semibold text-muted sm:col-span-1">{t.strength.instructions}
                          <input value={e.notes ?? ""} maxLength={1000} onChange={(v) => updEx(d.id, e.id, (x) => ({ ...x, notes: v.target.value || null }))} className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-sm outline-none focus:border-ink" />
                        </label>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-sm">
                          <thead><tr className="text-[11px] font-semibold text-muted">
                            <th className="w-8 py-1 text-left">#</th><th className="w-28 py-1 text-left">{t.common.status}</th>
                            <th className="py-1">{t.strength.reps}</th><th className="py-1">{t.strength.weight} (kg)</th><th className="py-1" title={t.strength.rirHelp}>{t.strength.rir}</th><th className="py-1">{t.strength.rpe}</th><th className="w-8" />
                          </tr></thead>
                          <tbody>
                            {e.sets.map((s, si) => (
                              <tr key={s.id}>
                                <td className="py-1 pr-1 text-xs font-bold text-muted tabular">{si + 1}</td>
                                <td className="py-1 pr-1.5">
                                  <NativeSelect aria-label={t.common.status} value={s.set_type} onChange={(v) => updSet(d.id, e.id, s.id, { set_type: v.target.value as SetType })} className="h-9 px-2 text-[13px]">
                                    {(["warmup", "working", "dropset"] as SetType[]).map((st) => <option key={st} value={st}>{t.strength.setTypes[st]}</option>)}
                                  </NativeSelect>
                                </td>
                                <td className="py-1 pr-1.5">
                                  <div className="flex items-center gap-1">
                                    <NumCell label={`${t.strength.reps} od`} value={s.reps_min} min={0} max={100} integer onChange={(v) => updSet(d.id, e.id, s.id, { reps_min: v, reps_max: s.reps_max != null && v != null && s.reps_max < v ? v : s.reps_max })} />
                                    <span className="text-faint">–</span>
                                    <NumCell label={`${t.strength.reps} do`} value={s.reps_max} min={0} max={100} integer onChange={(v) => updSet(d.id, e.id, s.id, { reps_max: v, reps_min: s.reps_min != null && v != null && s.reps_min > v ? v : s.reps_min })} />
                                  </div>
                                </td>
                                <td className="py-1 pr-1.5"><NumCell label={t.strength.weight} value={s.weight_kg} min={0} max={500} step={0.25} onChange={(v) => updSet(d.id, e.id, s.id, { weight_kg: v })} /></td>
                                <td className="py-1 pr-1.5"><NumCell label={t.strength.rir} value={s.rir} min={0} max={10} step={0.5} onChange={(v) => updSet(d.id, e.id, s.id, { rir: v })} /></td>
                                <td className="py-1 pr-1.5"><NumCell label={t.strength.rpe} value={s.rpe} min={1} max={10} step={0.5} onChange={(v) => updSet(d.id, e.id, s.id, { rpe: v })} /></td>
                                <td className="py-1"><Button variant="ghost" size="icon-sm" aria-label={t.common.remove} disabled={e.sets.length <= 1} onClick={() => updEx(d.id, e.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}><X /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" disabled={e.sets.length >= 20} onClick={() => updEx(d.id, e.id, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets.at(-1) ?? { set_type: "working", reps_min: 8, reps_max: 10, weight_kg: null, rir: 2, rpe: null, position: 0 }), id: uid(), position: x.sets.length } as PSet] }))}
                        className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-accent hover:bg-accent-soft"><Plus className="size-3.5" />{t.strength.addSet}</button>
                    </div>
                  );
                })}
                <Button type="button" variant="secondary" onClick={() => setPicker({ dayId: d.id })} disabled={d.exercises.length >= 30} className="border-dashed"><Plus className="size-4" />{t.strength.addExercise}</Button>
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
        {week && week.days.length === 0 && <p className="rounded-[20px] border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{t.strength.noDays}</p>}
        {week && <Button type="button" variant="secondary" size="lg" disabled={week.days.length >= 7}
          onClick={() => updWeek(week.id, (w) => ({ ...w, days: [...w.days, { id: uid(), day_of_week: null, position: w.days.length, name: `Trening ${String.fromCharCode(65 + w.days.length)}`, notes: null, exercises: [] }] }))}>
          <Plus className="size-4" />{t.strength.addDay}</Button>}
      </div>

      {/* Sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-white shadow-[var(--shadow-pop)] md:bottom-6 md:left-[calc(248px+1rem)]">
            <span className="flex-1 text-sm font-semibold">{t.strength.unsaved}</span>
            <Button variant="accent" onClick={save} loading={saving}><Save className="size-4" />{t.common.save}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} exercises={exercises} onPick={(ex) => picker && addExercise(picker.dayId, ex)} />
      <ProgressionDialog open={progOpen} onOpenChange={setProgOpen} onApply={copyToNextWeek} />
      <CopyDialog open={copyOpen} onOpenChange={setCopyOpen} clients={clients} defaultName={tree.name}
        onCopy={(clientId, name) => startBusy(async () => {
          const r = await copyProgramAction(tree.id, clientId, name);
          if (r.ok) { toast(t.strength.copied); setCopyOpen(false); router.push(`/trener/trening/${r.data.id}`); } else toast(r.error, "error");
        })} loading={busy} />
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t.common.delete} description={t.strength.deleteConfirm} confirmLabel={t.common.delete} loading={busy}
        onConfirm={() => startBusy(async () => { const r = await deleteProgramAction(tree.id); if (r.ok) { toast(t.strength.deleted); setDirty(false); router.replace("/trener/trening"); } else toast(r.error, "error"); })} />
    </div>
  );
}

function ProgressionDialog({ open, onOpenChange, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; onApply: (kg: number, reps: number) => void }) {
  const [kg, setKg] = useState<number | null>(2.5);
  const [reps, setReps] = useState<number | null>(0);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.strength.copyNextWeek} description={t.strength.progressionHelp} size="sm"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button><Button onClick={() => onApply(kg ?? 0, reps ?? 0)}>{t.strength.applyProgression}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-[13px] font-semibold">{t.strength.progressionKg}<NumCell label={t.strength.progressionKg} value={kg} min={0} max={20} step={0.25} onChange={setKg} className="h-11" /></label>
        <label className="grid gap-1.5 text-[13px] font-semibold">{t.strength.progressionReps}<NumCell label={t.strength.progressionReps} value={reps} min={0} max={5} integer onChange={setReps} className="h-11" /></label>
      </div>
    </Modal>
  );
}

function CopyDialog({ open, onOpenChange, clients, defaultName, onCopy, loading }: { open: boolean; onOpenChange: (o: boolean) => void; clients: { id: string; full_name: string }[]; defaultName: string; onCopy: (clientId: string | null, name: string) => void; loading: boolean }) {
  const [client, setClient] = useState("");
  const [name, setName] = useState(defaultName);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.strength.duplicate} size="sm"
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button><Button loading={loading} onClick={() => onCopy(client || null, name)}>{t.strength.duplicate}</Button></>}>
      <div className="grid gap-4">
        <Field label={t.strength.programName} htmlFor="copy_name"><Input id="copy_name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t.strength.assignTo} htmlFor="copy_client">
          <NativeSelect id="copy_client" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">{t.strength.noClient}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </NativeSelect>
        </Field>
      </div>
    </Modal>
  );
}
