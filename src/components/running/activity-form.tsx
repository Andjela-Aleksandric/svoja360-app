"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import type { Activity } from "@/lib/running/types";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { paceSecondsPerKm, formatPace } from "@/lib/utils/running";
import { createClient } from "@/lib/supabase/client";
import { saveActivityAction } from "@/app/actions/running";
import { deleteFileAction, registerFileAction } from "@/app/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { NumCell } from "@/components/strength/num-cell";
import { ScaleField } from "@/components/questionnaire/fields";
import { TimeCell } from "./time-cell";

export function ActivityForm({ activity, workouts, onDone, clientId, allowImport = true, preset }: {
  activity?: Activity; workouts: { id: string; label: string }[]; onDone: () => void; clientId?: string; allowImport?: boolean;
  preset?: { workout_id: string; title: string; km: number | null; duration_s: number | null };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    performed_on: activity?.performed_on ?? todayISO(), started_at: activity?.started_at ?? null, title: activity?.title ?? preset?.title ?? "",
    km: activity ? activity.distance_m / 1000 : preset?.km ?? null as number | null, duration_s: activity?.duration_s ?? preset?.duration_s ?? null as number | null,
    avg_hr: activity?.avg_hr ?? null, max_hr: activity?.max_hr ?? null, avg_power: activity?.avg_power ?? null, elevation_gain_m: activity?.elevation_gain_m ?? null,
    rpe: activity?.rpe ?? null as number | null, notes: activity?.notes ?? "", workout_id: activity?.workout_id ?? preset?.workout_id ?? "", source: activity?.source ?? "manual" as Activity["source"],
  });

  async function importFile(fl: File | null) {
    if (!fl) return;
    setParsing(true);
    try {
      const { parseFit, parseGpx } = await import("@/lib/running/parse");
      const isFit = fl.name.toLowerCase().endsWith(".fit");
      const a = isFit ? await parseFit(await fl.arrayBuffer()) : parseGpx(await fl.text());
      if (!a.distance_m || !a.duration_s) throw new Error("empty");
      setF((x) => ({ ...x, performed_on: a.performed_on, started_at: a.started_at, title: x.title || a.title || "", km: Math.round(a.distance_m / 10) / 100, duration_s: a.duration_s,
        avg_hr: a.avg_hr, max_hr: a.max_hr, avg_power: a.avg_power, elevation_gain_m: a.elevation_gain_m, source: isFit ? "fit" : "gpx" }));
      setFile(fl);
      toast(t.running.checkFile);
    } catch {
      toast(t.running.importFailed, "error");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const submit = () => start(async () => {
    const e: Record<string, string> = {};
    if (!f.km || f.km <= 0) e.km = t.validation.required;
    if (!f.duration_s) e.duration_s = t.validation.required;
    if (!f.performed_on || f.performed_on > todayISO()) e.performed_on = t.validation.date;
    setErrors(e);
    if (Object.keys(e).length) return;
    let file_id = activity?.file_id ?? null;
    if (file && !clientId) {
      const reg = await registerFileAction({ kind: "activity_file", fileName: file.name, mimeType: file.type || (file.name.toLowerCase().endsWith(".gpx") ? "application/gpx+xml" : "application/octet-stream"), size: file.size, takenOn: f.performed_on });
      if (reg.ok) {
        const { error } = await createClient().storage.from("client-files").upload(reg.data.path, file, { contentType: file.type || "application/octet-stream" });
        if (error) await deleteFileAction(reg.data.id); else file_id = reg.data.id;
      }
    }
    const r = await saveActivityAction({
      id: activity?.id, client_id: clientId, workout_id: f.workout_id || null, performed_on: f.performed_on, started_at: f.started_at, distance_m: Math.round(f.km! * 1000), duration_s: f.duration_s!,
      avg_hr: f.avg_hr, max_hr: f.max_hr, avg_power: f.avg_power, elevation_gain_m: f.elevation_gain_m, source: f.source, file_id, title: f.title.trim() || null, notes: f.notes.trim() || null, rpe: f.rpe,
    });
    if (r.ok) { toast(t.running.saved); onDone(); router.refresh(); } else { setErrors(r.fieldErrors ?? {}); toast(r.error, "error"); }
  });

  const pace = f.km && f.duration_s ? paceSecondsPerKm(f.km * 1000, f.duration_s) : null;

  return (
    <div className="grid gap-4">
      {allowImport && !activity && (
        <div className="rounded-[16px] border border-dashed border-line-strong bg-subtle/50 p-4">
          <input ref={fileRef} type="file" accept=".gpx,.fit,application/gpx+xml" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => importFile(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={parsing} className="w-full">{parsing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}{t.running.importFile}</Button>
          <p className="mt-2 text-center text-xs text-muted">{file ? file.name : t.running.importHelp}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.running.activityDate} htmlFor="a-date" error={errors.performed_on}><Input id="a-date" type="date" max={todayISO()} value={f.performed_on} onChange={(e) => setF({ ...f, performed_on: e.target.value })} /></Field>
        <Field label={t.running.title} htmlFor="a-title" optional><Input id="a-title" value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label={t.running.distanceKm} htmlFor="a-km" error={errors.km}><NumCell label={t.running.distanceKm} value={f.km} min={0.01} max={400} step={0.01} onChange={(v) => setF({ ...f, km: v })} className="h-11" /></Field>
        <Field label={t.running.duration} htmlFor="a-dur" help={t.running.durationHelp} error={errors.duration_s}><TimeCell kind="duration" label={t.running.duration} value={f.duration_s} min={1} max={172800} onChange={(v) => setF({ ...f, duration_s: v })} className="h-11" /></Field>
      </div>
      {pace && <p className="-mt-1 text-sm text-muted">{t.running.avgPace}: <strong className="tabular text-ink">{formatPace(pace)} min/km</strong></p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label={t.running.avgHr} htmlFor="a-hr" optional><NumCell label={t.running.avgHr} value={f.avg_hr} min={40} max={230} integer onChange={(v) => setF({ ...f, avg_hr: v })} className="h-11" /></Field>
        <Field label={t.running.maxHr} htmlFor="a-mhr" optional><NumCell label={t.running.maxHr} value={f.max_hr} min={40} max={240} integer onChange={(v) => setF({ ...f, max_hr: v })} className="h-11" /></Field>
        <Field label={t.running.elevation} htmlFor="a-el" optional><NumCell label={t.running.elevation} value={f.elevation_gain_m} min={0} max={20000} integer onChange={(v) => setF({ ...f, elevation_gain_m: v })} className="h-11" /></Field>
        <Field label={t.running.avgPower} htmlFor="a-pw" optional><NumCell label={t.running.avgPower} value={f.avg_power} min={0} max={1000} integer onChange={(v) => setF({ ...f, avg_power: v })} className="h-11" /></Field>
      </div>
      {workouts.length > 0 && (
        <Field label={t.running.linkWorkout} htmlFor="a-wo" optional>
          <NativeSelect id="a-wo" value={f.workout_id} onChange={(e) => setF({ ...f, workout_id: e.target.value })}><option value="">–</option>{workouts.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</NativeSelect>
        </Field>
      )}
      <div className="grid gap-1.5"><span className="text-[13px] font-semibold">{t.running.rpe}</span><ScaleField id="a-rpe" value={f.rpe} onChange={(v) => setF({ ...f, rpe: v })} /></div>
      <Field label={t.common.notes} htmlFor="a-notes" optional><Textarea id="a-notes" rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button><Button onClick={submit} loading={pending}>{t.common.save}</Button></div>
    </div>
  );
}
