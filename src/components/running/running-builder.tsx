"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowDown, ArrowUp, CheckCircle2, Minimize2, Split, Copy, CopyPlus, LayoutTemplate, MoreHorizontal, Play, Plus, Save, Trash2, X } from "lucide-react";
import type { RSegment, RunningTree, RWeek, RWorkout, SegmentType, WorkoutType, Zone } from "@/lib/running/types";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { estimateWorkoutDistanceM, estimateWorkoutDurationS, formatDuration, formatPace } from "@/lib/utils/running";
import { formatNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { NumCell } from "@/components/strength/num-cell";
import { Segmented } from "@/components/ui/tabs";
import { deleteProgramAction, setProgramStatusAction } from "@/app/trener/trening/actions";
import { copyRunningProgramAction, saveRunningProgramAction } from "@/app/trener/trcanje/actions";
import { TimeCell } from "./time-cell";

const uid = () => crypto.randomUUID();
const statusTone = { draft: "neutral", active: "success", completed: "info", archived: "outline" } as const;
const TYPES = Object.keys(t.running.types) as WorkoutType[];
const SEG_TYPES = Object.keys(t.running.segmentTypes) as SegmentType[];

const newSegment = (type: SegmentType, position: number): RSegment => ({
  id: uid(), position, segment_type: type, repeat_count: 1, duration_s: type === "warmup" || type === "cooldown" ? 600 : null, distance_m: null,
  pace_min_s_km: null, pace_max_s_km: null, hr_min: null, hr_max: null, power_min: null, power_max: null, recovery_s: null, instructions: null,
});

function renumber(tree: RunningTree): RunningTree {
  return { ...tree, weeks: tree.weeks.map((w, i) => ({ ...w, week_number: i + 1, workouts: w.workouts.map((x, j) => ({ ...x, position: j, segments: x.segments.map((s, k) => ({ ...s, position: k })) })) })) };
}

export function RunningBuilder({ initial, clients, clientName }: { initial: RunningTree; clients: { id: string; full_name: string }[]; clientName: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tree, setTree] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [wi, setWi] = useState(0);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyClient, setCopyClient] = useState("");
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const week = tree.weeks[Math.min(wi, tree.weeks.length - 1)];

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const update = (fn: (x: RunningTree) => RunningTree) => { setTree((c) => renumber(fn(c))); setDirty(true); };
  const updWeek = (fn: (w: RWeek) => RWeek) => update((x) => ({ ...x, weeks: x.weeks.map((w) => (w.id === week.id ? fn(w) : w)) }));
  const updWo = (id: string, fn: (w: RWorkout) => RWorkout) => updWeek((w) => ({ ...w, workouts: w.workouts.map((x) => (x.id === id ? fn(x) : x)) }));
  const updSeg = (wo: string, sid: string, p: Partial<RSegment>) => updWo(wo, (x) => ({ ...x, segments: x.segments.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const move = <T,>(arr: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

  const save = () => startSave(async () => {
    const r = await saveRunningProgramAction(tree);
    if (r.ok) { setDirty(false); toast(t.strength.saved); router.refresh(); } else toast(r.error, "error");
  });
  const setStatus = (status: RunningTree["status"], msg: string) => startBusy(async () => {
    if (dirty) { const r = await saveRunningProgramAction(tree); if (!r.ok) { toast(r.error, "error"); return; } setDirty(false); }
    const r = await setProgramStatusAction(tree.id, status, "running_programs");
    if (r.ok) { setTree((x) => ({ ...x, status })); toast(msg); router.refresh(); } else toast(r.error, "error");
  });

  const weekKm = week ? week.workouts.reduce((s, w) => s + estimateWorkoutDistanceM(w.segments), 0) / 1000 : 0;
  const weekMin = week ? Math.round(week.workouts.reduce((s, w) => s + estimateWorkoutDurationS(w.segments), 0) / 60) : 0;
  const [structured, setStructured] = useState<Record<string, boolean>>({});
  const isSimple = (w: RWorkout) => !structured[w.id] && w.segments.length <= 1 && (w.segments[0]?.repeat_count ?? 1) === 1 && (!w.segments[0] || w.segments[0].segment_type === "main");
  const [unitPref, setUnitPref] = useState<Record<string, "km" | "min">>({});
  const targetUnit: "km" | "min" = week ? (week.target_minutes != null ? "min" : week.target_km != null ? "km" : unitPref[week.id] ?? "km") : "km";

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted"><Badge tone={statusTone[tree.status]}>{t.strength.status[tree.status]}</Badge>{clientName ?? t.strength.noClient}</div>
          <input aria-label={t.strength.programName} value={tree.name} maxLength={120} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="w-full rounded-[10px] bg-transparent text-[26px] font-extrabold tracking-[-0.02em] outline-none focus:bg-surface sm:text-[30px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setZonesOpen(true)}>{t.running.zones}{tree.zones.length ? ` · ${tree.zones.length}` : ""}</Button>
          {tree.client_id && tree.status !== "active" && <Button variant="accent" onClick={() => setStatus("active", t.strength.activated)} loading={busy}><Play className="size-4" />{t.strength.activate}</Button>}
          <Dropdown>
            <DropdownTrigger asChild><Button variant="secondary" size="icon" aria-label={t.common.actions}><MoreHorizontal className="size-4" /></Button></DropdownTrigger>
            <DropdownContent>
              {tree.status === "active" && <DropdownItem onSelect={() => setStatus("completed", t.common.saved)}><CheckCircle2 />{t.strength.complete}</DropdownItem>}
              <DropdownItem onSelect={() => setCopyOpen(true)}><CopyPlus />{t.strength.duplicate}</DropdownItem>
              {tree.status !== "archived" ? <DropdownItem onSelect={() => setStatus("archived", t.common.saved)}><Archive />{t.common.archive}</DropdownItem> : <DropdownItem onSelect={() => setStatus("draft", t.common.saved)}><LayoutTemplate />{t.common.restore}</DropdownItem>}
              <DropdownSeparator />
              <DropdownItem danger onSelect={() => setDeleteOpen(true)}><Trash2 />{t.common.delete}</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <div className="mb-5 grid gap-4 rounded-[20px] border border-line bg-surface p-4 sm:grid-cols-[180px_1fr] sm:p-5">
        <Field label={t.strength.startDate} htmlFor="r_start"><Input id="r_start" type="date" value={tree.start_date ?? ""} onChange={(e) => update((x) => ({ ...x, start_date: e.target.value || null }))} /></Field>
        <Field label={t.common.description} htmlFor="r_desc" optional><Textarea id="r_desc" rows={1} className="min-h-11" value={tree.description ?? ""} onChange={(e) => update((x) => ({ ...x, description: e.target.value || null }))} /></Field>
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {tree.weeks.map((w, i) => (
          <button key={w.id} role="tab" aria-selected={i === wi} onClick={() => setWi(i)} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold", i === wi ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>{t.strength.week(w.week_number)}</button>
        ))}
        <button onClick={() => { update((x) => ({ ...x, weeks: [...x.weeks, { id: uid(), week_number: x.weeks.length + 1, target_km: null, target_minutes: null, notes: null, workouts: [] }] })); setWi(tree.weeks.length); }} disabled={tree.weeks.length >= 52}
          aria-label={t.strength.addWeek} className="grid size-10 shrink-0 place-items-center rounded-full text-muted ring-1 ring-line-strong hover:text-ink"><Plus className="size-4" /></button>
      </div>

      {week && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1 text-[12px] font-semibold text-muted">
            <span>{t.running.weekTarget} <span className="font-normal text-faint">({t.running.optional})</span></span>
            <div className="flex items-center gap-2">
              <Segmented size="sm" value={targetUnit} onChange={(u) => { setUnitPref((m) => ({ ...m, [week.id]: u })); updWeek((w) => (u === "km" ? { ...w, target_minutes: null } : { ...w, target_km: null })); }}
                options={[{ value: "km", label: t.running.unitKm }, { value: "min", label: t.running.unitMin }]} />
              {targetUnit === "km"
                ? <NumCell label={t.running.targetKm} value={week.target_km} min={0} max={300} step={0.1} onChange={(v) => updWeek((w) => ({ ...w, target_km: v }))} className="h-10 w-24" />
                : <NumCell label={t.running.weekTarget} value={week.target_minutes} min={0} max={3000} integer onChange={(v) => updWeek((w) => ({ ...w, target_minutes: v }))} className="h-10 w-24" />}
            </div>
          </div>
          <span className="pb-2.5 text-sm text-muted">{t.running.plannedEstimate}: <strong className="tabular text-ink">{[weekKm > 0 ? `${formatNumber(weekKm, 1)} km` : null, weekMin > 0 ? formatDuration(weekMin * 60) : null].filter(Boolean).join(" · ") || "–"}</strong></span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" disabled={!week.workouts.length} onClick={() => {
            update((x) => {
              const i = x.weeks.findIndex((w) => w.id === week.id);
              const clone: RWeek = { ...week, id: x.weeks[i + 1]?.id ?? uid(), workouts: week.workouts.map((w) => ({ ...w, id: uid(), scheduled_date: null, segments: w.segments.map((s) => ({ ...s, id: uid() })) })) };
              const weeks = [...x.weeks]; if (x.weeks[i + 1]) weeks[i + 1] = clone; else weeks.push(clone);
              return { ...x, weeks };
            });
            setWi(wi + 1);
          }}><Copy className="size-4" />{t.strength.copyNextWeek}</Button>
          {tree.weeks.length > 1 && <Button size="sm" variant="ghost" onClick={() => { update((x) => ({ ...x, weeks: x.weeks.filter((w) => w.id !== week.id) })); setWi(Math.max(0, wi - 1)); }}><Trash2 className="size-4" />{t.strength.removeWeek}</Button>}
        </div>
      )}

      <div className="grid gap-4">
        <AnimatePresence initial={false}>
          {week?.workouts.map((w, i) => {
            const dist = estimateWorkoutDistanceM(w.segments), dur = estimateWorkoutDurationS(w.segments);
            return (
              <motion.section key={w.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[22px] border border-line bg-surface">
                <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-[1fr_200px_160px_auto] sm:items-center sm:px-5">
                  <input aria-label={t.running.workoutTitle} value={w.title} maxLength={120} onChange={(e) => updWo(w.id, (x) => ({ ...x, title: e.target.value }))} className="min-w-0 rounded-[8px] bg-transparent px-1 py-1 text-[16px] font-bold outline-none focus:bg-subtle" />
                  <NativeSelect aria-label={t.running.workoutType} value={w.workout_type} onChange={(e) => updWo(w.id, (x) => ({ ...x, workout_type: e.target.value as WorkoutType }))} className="h-9 text-sm">
                    {TYPES.map((k) => <option key={k} value={k}>{t.running.types[k]}</option>)}
                  </NativeSelect>
                  <NativeSelect aria-label={t.strength.dayOfWeek} value={w.day_of_week ?? ""} onChange={(e) => updWo(w.id, (x) => ({ ...x, day_of_week: e.target.value ? Number(e.target.value) : null }))} className="h-9 text-sm">
                    <option value="">{t.strength.noDayOfWeek}</option>{t.weekdays.map((d, k) => <option key={d} value={k + 1}>{d}</option>)}
                  </NativeSelect>
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveUp} disabled={i === 0} onClick={() => updWeek((x) => ({ ...x, workouts: move(x.workouts, i, -1) }))}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveDown} disabled={i === week.workouts.length - 1} onClick={() => updWeek((x) => ({ ...x, workouts: move(x.workouts, i, 1) }))}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => updWeek((x) => ({ ...x, workouts: x.workouts.filter((y) => y.id !== w.id) }))}><Trash2 /></Button>
                  </div>
                </div>
                <div className="grid gap-3 p-3 sm:p-4">
                  {isSimple(w) ? (
                    <SimpleRun w={w} zones={tree.zones} onChange={(seg) => updWo(w.id, (x) => ({ ...x, segments: seg ? [seg] : [] }))}
                      onSplit={() => updWo(w.id, (x) => ({ ...x, segments: x.segments.length ? x.segments : [newSegment("main", 0)] }))} forceStructured={(id) => setStructured((m) => ({ ...m, [id]: true }))} />
                  ) : (
                  <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted">{t.running.estimate}: <strong className="tabular text-ink">{[dist > 0 ? `${formatNumber(dist / 1000, 1)} km` : null, dur > 0 ? formatDuration(dur) : null].filter(Boolean).join(" · ") || "–"}</strong></div>
                    <button type="button" onClick={() => { setStructured((m) => ({ ...m, [w.id]: false })); updWo(w.id, (x) => ({ ...x, segments: [mergeSegments(x.segments)] })); }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-muted ring-1 ring-line transition-colors hover:text-ink hover:ring-ink"><Minimize2 className="size-3.5" />{t.running.merge}</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[940px] text-sm">
                      <thead><tr className="text-left text-[11px] font-semibold text-muted">
                        <th className="w-36 py-1">{t.running.part}</th><th className="w-16 py-1 pr-2">{t.running.repeatShort}</th><th className="w-24 py-1">{t.running.distance} (m)</th><th className="w-20 py-1">{t.running.duration}</th>
                        <th className="w-36 py-1">{t.running.pace} (min/km)</th><th className="w-32 py-1">{t.running.heartRate}</th><th className="w-20 py-1">{t.running.recovery}</th><th className="py-1">{t.running.instructions}</th><th className="w-8" />
                      </tr></thead>
                      <tbody>
                        {w.segments.map((s) => (
                          <tr key={s.id} className="align-top">
                            <td className="py-1 pr-1.5"><NativeSelect aria-label={t.common.status} value={s.segment_type} onChange={(e) => updSeg(w.id, s.id, { segment_type: e.target.value as SegmentType })} className="h-9 px-2 text-[13px]">{SEG_TYPES.map((k) => <option key={k} value={k}>{t.running.segmentTypes[k]}</option>)}</NativeSelect>
                              {tree.zones.length > 0 && <NativeSelect aria-label={t.running.zones} value="" onChange={(e) => { const z = tree.zones[Number(e.target.value)]; if (z) updSeg(w.id, s.id, { pace_min_s_km: z.pace_min, pace_max_s_km: z.pace_max, hr_min: z.hr_min, hr_max: z.hr_max }); }} className="mt-1 h-8 px-2 text-[12px]"><option value="">{t.running.applyZone}</option>{tree.zones.map((z, k) => <option key={k} value={k}>{z.name}</option>)}</NativeSelect>}
                            </td>
                            <td className="py-1 pr-1.5"><NumCell label={t.running.repeat} value={s.repeat_count} min={1} max={50} integer onChange={(v) => updSeg(w.id, s.id, { repeat_count: v ?? 1 })} /></td>
                            <td className="py-1 pr-1.5"><NumCell label={t.running.distance} value={s.distance_m} min={1} max={100000} integer onChange={(v) => updSeg(w.id, s.id, { distance_m: v })} /></td>
                            <td className="py-1 pr-1.5"><TimeCell kind="duration" label={t.running.duration} value={s.duration_s} min={1} max={36000} onChange={(v) => updSeg(w.id, s.id, { duration_s: v })} /></td>
                            <td className="py-1 pr-1.5"><div className="flex items-center gap-1"><TimeCell kind="pace" label={t.running.paceFrom} value={s.pace_min_s_km} min={120} max={1200} onChange={(v) => updSeg(w.id, s.id, { pace_min_s_km: v })} /><span className="text-faint">–</span><TimeCell kind="pace" label={t.running.paceTo} value={s.pace_max_s_km} min={120} max={1200} onChange={(v) => updSeg(w.id, s.id, { pace_max_s_km: v })} /></div></td>
                            <td className="py-1 pr-1.5"><div className="flex items-center gap-1"><NumCell label={`${t.running.heartRate} od`} value={s.hr_min} min={40} max={230} integer onChange={(v) => updSeg(w.id, s.id, { hr_min: v })} /><span className="text-faint">–</span><NumCell label={`${t.running.heartRate} do`} value={s.hr_max} min={40} max={230} integer onChange={(v) => updSeg(w.id, s.id, { hr_max: v })} /></div></td>
                            <td className="py-1 pr-1.5"><TimeCell kind="duration" label={t.running.recovery} value={s.recovery_s} min={0} max={3600} onChange={(v) => updSeg(w.id, s.id, { recovery_s: v })} placeholder="1:30" /></td>
                            <td className="py-1 pr-1.5"><input aria-label={t.running.instructions} value={s.instructions ?? ""} maxLength={500} onChange={(e) => updSeg(w.id, s.id, { instructions: e.target.value || null })} className="h-9 w-full rounded-[10px] border border-line bg-surface px-2 text-sm outline-none focus:border-ink" /></td>
                            <td className="py-1"><Button variant="ghost" size="icon-sm" aria-label={t.common.remove} onClick={() => updWo(w.id, (x) => ({ ...x, segments: x.segments.filter((y) => y.id !== s.id) }))}><X /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(["warmup", "main", "interval", "cooldown"] as SegmentType[]).map((k) => (
                      <button key={k} type="button" disabled={w.segments.length >= 30} onClick={() => updWo(w.id, (x) => ({ ...x, segments: [...x.segments, newSegment(k, x.segments.length)] }))} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-accent hover:bg-accent-soft"><Plus className="size-3.5" />{t.running.segmentTypes[k]}</button>
                    ))}
                  </div>
                  </>
                  )}
                  <input aria-label={t.running.instructions} placeholder={t.running.workoutNotes} value={w.notes ?? ""} maxLength={2000} onChange={(e) => updWo(w.id, (x) => ({ ...x, notes: e.target.value || null }))} className="h-10 rounded-[12px] border border-line bg-surface px-3 text-sm outline-none focus:border-ink" />
                </div>
              </motion.section>
            );
          })}
        </AnimatePresence>
        {week && week.workouts.length === 0 && <p className="rounded-[20px] border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{t.running.noWorkouts}</p>}
        {week && <Button variant="secondary" size="lg" disabled={week.workouts.length >= 14} onClick={() => updWeek((w) => ({ ...w, workouts: [...w.workouts, { id: uid(), day_of_week: null, scheduled_date: null, workout_type: "easy", title: t.running.types.easy, notes: null, position: w.workouts.length, segments: [newSegment("main", 0)] }] }))}><Plus className="size-4" />{t.running.addWorkout}</Button>}
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-white shadow-[var(--shadow-pop)] md:bottom-6 md:left-[calc(248px+1rem)]">
            <span className="flex-1 text-sm font-semibold">{t.strength.unsaved}</span>
            <Button variant="accent" onClick={save} loading={saving}><Save className="size-4" />{t.common.save}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={zonesOpen} onOpenChange={setZonesOpen} title={t.running.zones} description={t.running.zonesHelp} size="lg">
        <ZonesEditor zones={tree.zones} onChange={(zones) => update((x) => ({ ...x, zones }))} />
      </Modal>
      <Modal open={copyOpen} onOpenChange={setCopyOpen} title={t.strength.duplicate} size="sm"
        footer={<><Button variant="secondary" onClick={() => setCopyOpen(false)}>{t.common.cancel}</Button><Button loading={busy} onClick={() => startBusy(async () => { const r = await copyRunningProgramAction(tree.id, copyClient || null, tree.name); if (r.ok) { setCopyOpen(false); router.push(`/trener/trcanje/${r.data.id}`); } else toast(r.error, "error"); })}>{t.strength.duplicate}</Button></>}>
        <Field label={t.strength.assignTo} htmlFor="rc"><NativeSelect id="rc" value={copyClient} onChange={(e) => setCopyClient(e.target.value)}><option value="">{t.strength.noClient}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</NativeSelect></Field>
      </Modal>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t.common.delete} description={t.strength.deleteConfirm} confirmLabel={t.common.delete} loading={busy}
        onConfirm={() => startBusy(async () => { const r = await deleteProgramAction(tree.id, "running_programs"); if (r.ok) { setDirty(false); router.replace("/trener/trcanje"); } else toast(r.error, "error"); })} />
    </div>
  );
}

function ZonesEditor({ zones, onChange }: { zones: Zone[]; onChange: (z: Zone[]) => void }) {
  const set = (i: number, p: Partial<Zone>) => onChange(zones.map((z, k) => (k === i ? { ...z, ...p } : z)));
  return (
    <div className="grid gap-2">
      {zones.map((z, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-[14px] border border-line p-3 sm:grid-cols-[100px_1fr_1fr_auto]">
          <label className="grid gap-1 text-[11px] font-semibold text-muted">{t.running.zoneName}<input value={z.name} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} className="h-9 rounded-[10px] border border-line px-2 text-sm font-semibold outline-none focus:border-ink" /></label>
          <label className="col-span-2 grid gap-1 text-[11px] font-semibold text-muted sm:col-span-1">{t.running.pace}<div className="flex items-center gap-1"><TimeCell kind="pace" label={t.running.paceFrom} value={z.pace_min} min={120} max={1200} onChange={(v) => set(i, { pace_min: v })} /><span>–</span><TimeCell kind="pace" label={t.running.paceTo} value={z.pace_max} min={120} max={1200} onChange={(v) => set(i, { pace_max: v })} /></div></label>
          <label className="grid gap-1 text-[11px] font-semibold text-muted">{t.running.heartRate}<div className="flex items-center gap-1"><NumCell label="HR od" value={z.hr_min} min={40} max={230} integer onChange={(v) => set(i, { hr_min: v })} /><span>–</span><NumCell label="HR do" value={z.hr_max} min={40} max={230} integer onChange={(v) => set(i, { hr_max: v })} /></div></label>
          <Button variant="ghost" size="icon-sm" aria-label={t.common.remove} onClick={() => onChange(zones.filter((_, k) => k !== i))}><X /></Button>
        </div>
      ))}
      {zones.length === 0 && <p className="text-sm text-muted">{t.running.noZones}</p>}
      <Button variant="secondary" disabled={zones.length >= 8} onClick={() => onChange([...zones, { name: `Z${zones.length + 1}`, pace_min: null, pace_max: null, hr_min: null, hr_max: null }])}><Plus className="size-4" />{t.running.addZone}</Button>
      <p className="text-xs text-muted">{zones.map((z) => `${z.name}: ${formatPace(z.pace_min)}–${formatPace(z.pace_max)}`).join(" · ")}</p>
    </div>
  );
}

/** A whole run as one part: merges a structured workout into a single main segment (totals kept). */
function mergeSegments(segs: RSegment[]): RSegment {
  const dist = estimateWorkoutDistanceM(segs), dur = estimateWorkoutDurationS(segs);
  const main = segs.find((x) => x.segment_type === "main") ?? segs[0];
  return { ...(main ?? newSegment("main", 0)), id: main?.id ?? uid(), position: 0, segment_type: "main", repeat_count: 1, recovery_s: null,
    distance_m: segs.some((x) => x.distance_m) ? dist || null : null, duration_s: segs.some((x) => x.distance_m) ? null : dur || null };
}

/** One-part run: choose time, distance or no target. Pace and heart rate are optional. */
function SimpleRun({ w, zones, onChange, onSplit, forceStructured }: { w: RWorkout; zones: Zone[]; onChange: (s: RSegment | null) => void; onSplit: () => void; forceStructured: (id: string) => void }) {
  const seg = w.segments[0] ?? null;
  const [pref, setPref] = useState<"time" | "distance" | "feel">(seg?.distance_m ? "distance" : seg?.duration_s ? "time" : "time");
  const mode = seg?.distance_m ? "distance" : seg?.duration_s ? "time" : pref;
  const patch = (p: Partial<RSegment>) => onChange({ ...(seg ?? newSegment("main", 0)), segment_type: "main", repeat_count: 1, ...p });
  const lbl = "grid gap-1 text-[12px] font-semibold text-muted";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[auto_150px_1fr_1fr] sm:items-end">
        <div className={lbl}>{t.running.measureBy}
          <Segmented size="sm" value={mode} onChange={(m) => { setPref(m); patch(m === "time" ? { distance_m: null } : m === "distance" ? { duration_s: null } : { distance_m: null, duration_s: null }); }}
            options={[{ value: "time", label: t.running.byTime }, { value: "distance", label: t.running.byDistance }, { value: "feel", label: t.running.byFeel }]} />
        </div>
        {mode === "time" && <label className={lbl}>{t.running.duration}<TimeCell kind="duration" label={t.running.duration} value={seg?.duration_s ?? null} min={60} max={36000} placeholder="45:00" onChange={(v) => patch({ duration_s: v, distance_m: null })} className="h-10" /></label>}
        {mode === "distance" && <label className={lbl}>{t.running.distanceKm}<NumCell label={t.running.distanceKm} value={seg?.distance_m ? Math.round(seg.distance_m / 10) / 100 : null} min={0.1} max={100} step={0.1} onChange={(v) => patch({ distance_m: v ? Math.round(v * 1000) : null, duration_s: null })} className="h-10" /></label>}
        {mode === "feel" && <span className="hidden sm:block" />}
        <label className={lbl}><span>{t.running.pace} <span className="font-normal text-faint">({t.running.optional})</span></span>
          <div className="flex items-center gap-1"><TimeCell kind="pace" label={t.running.paceFrom} value={seg?.pace_min_s_km ?? null} min={120} max={1200} onChange={(v) => patch({ pace_min_s_km: v })} className="h-10" /><span className="text-faint">–</span><TimeCell kind="pace" label={t.running.paceTo} value={seg?.pace_max_s_km ?? null} min={120} max={1200} onChange={(v) => patch({ pace_max_s_km: v })} className="h-10" /></div>
        </label>
        <label className={lbl}><span>{t.running.heartRate} <span className="font-normal text-faint">({t.running.optional})</span></span>
          <div className="flex items-center gap-1"><NumCell label={`${t.running.heartRate} od`} value={seg?.hr_min ?? null} min={40} max={230} integer onChange={(v) => patch({ hr_min: v })} className="h-10" /><span className="text-faint">–</span><NumCell label={`${t.running.heartRate} do`} value={seg?.hr_max ?? null} min={40} max={230} integer onChange={(v) => patch({ hr_max: v })} className="h-10" /></div>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {zones.length > 0 && (
          <div className="w-44"><NativeSelect aria-label={t.running.zones} value="" onChange={(e) => { const z = zones[Number(e.target.value)]; if (z) patch({ pace_min_s_km: z.pace_min, pace_max_s_km: z.pace_max, hr_min: z.hr_min, hr_max: z.hr_max }); }} className="h-9 text-[13px]"><option value="">{t.running.applyZone}</option>{zones.map((z, k) => <option key={k} value={k}>{z.name}</option>)}</NativeSelect></div>
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => { forceStructured(w.id); onSplit(); }} title={t.running.splitHelp}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"><Split className="size-3.5" />{t.running.split}</button>
      </div>
    </div>
  );
}
