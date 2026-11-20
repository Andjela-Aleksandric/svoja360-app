"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import type { ExerciseItem } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { archiveExerciseAction, saveExerciseAction } from "./actions";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
type Muscle = { id: number; name: string };

export function ExerciseLibrary({ exercises, muscles }: { exercises: ExerciseItem[]; muscles: Muscle[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [edit, setEdit] = useState<ExerciseItem | "new" | null>(null);
  const [, start] = useTransition();
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const list = useMemo(() => {
    const n = fold(q.trim());
    return exercises.filter((e) => e.is_archived === showArchived && (!n || fold(e.name).includes(n)) && (!muscle || e.muscles.some((m) => String(m.id) === muscle)) && (!equipment || e.equipment === equipment));
  }, [exercises, q, muscle, equipment, showArchived]);

  return (
    <>
      <PageHeader title={t.exercises.title} description={t.exercises.subtitle} action={<Button onClick={() => setEdit("new")}><Plus className="size-4" />{t.exercises.add}</Button>} />
      <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_220px_200px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.exercises.searchPlaceholder} className="pl-10" type="search" /></div>
        <NativeSelect value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label={t.strength.filterMuscle}><option value="">{t.strength.allMuscles}</option>{muscles.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect>
        <NativeSelect value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label={t.exercises.equipment}><option value="">{t.exercises.equipment}</option>{Object.entries(t.exercises.equipmentTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        <Button variant={showArchived ? "primary" : "secondary"} onClick={() => setShowArchived(!showArchived)}><Archive className="size-4" />{t.clients.filters.archived}</Button>
      </div>
      {list.length === 0 ? <EmptyState icon={<Search />} title={t.exercises.empty} /> : (
        <ul className="stagger grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.id} className="group lift flex flex-col rounded-[18px] border border-line bg-surface p-4 hover:border-line-strong">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold leading-tight">{e.name}</div>
                  {e.parent_id && byId.get(e.parent_id) && <div className="text-xs text-muted">{t.exercises.variationOf}: {byId.get(e.parent_id)!.name}</div>}
                </div>
                {e.is_custom && <Badge tone="outline">{t.exercises.custom}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {e.muscles.map((m) => <span key={m.id} className={m.is_primary ? "rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white" : "rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-muted"}>{m.name}</span>)}
              </div>
              <div className="mt-2 text-xs text-muted">{t.exercises.equipmentTypes[e.equipment]} · {t.exercises.types[e.exercise_type]} · {t.exercises.patterns[e.movement_pattern]}</div>
              <div className="mt-auto flex items-center gap-1 pt-3">
                {e.media_url && <a href={e.media_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent-soft">Video <ExternalLink className="size-3" /></a>}
                <span className="flex-1" />
                <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEdit(e)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={e.is_archived ? t.common.restore : t.common.archive}
                  onClick={() => start(async () => { const r = await archiveExerciseAction(e.id, !e.is_archived); if (r.ok) router.refresh(); else toast(r.error, "error"); })}>
                  {e.is_archived ? <RotateCcw /> : <Archive />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? t.exercises.add : t.common.edit} size="lg">
        {edit && <ExerciseForm exercise={edit === "new" ? null : edit} muscles={muscles} exercises={exercises} onDone={() => { setEdit(null); router.refresh(); }} />}
      </Modal>
    </>
  );
}

function ExerciseForm({ exercise, muscles, exercises, onDone }: { exercise: ExerciseItem | null; muscles: Muscle[]; exercises: ExerciseItem[]; onDone: () => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    name: exercise?.name ?? "", equipment: exercise?.equipment ?? "barbell", exercise_type: exercise?.exercise_type ?? "compound", movement_pattern: exercise?.movement_pattern ?? "other",
    instructions: exercise?.instructions ?? "", media_url: exercise?.media_url ?? "", parent_id: exercise?.parent_id ?? "",
    primary: exercise?.muscles.find((m) => m.is_primary)?.id ?? muscles[0]?.id, secondary: exercise?.muscles.filter((m) => !m.is_primary).map((m) => m.id) ?? [],
  });
  const submit = () => start(async () => {
    const r = await saveExerciseAction({
      id: exercise?.id, name: f.name, equipment: f.equipment as never, exercise_type: f.exercise_type as never, movement_pattern: f.movement_pattern as never,
      instructions: f.instructions.trim() || null, media_url: f.media_url.trim() || null, parent_id: f.parent_id || null, primary: Number(f.primary), secondary: f.secondary,
    });
    if (r.ok) { toast(exercise ? t.common.saved : t.exercises.created); onDone(); } else { setErrors(r.fieldErrors ?? {}); toast(r.error, "error"); }
  });
  return (
    <div className="grid gap-4">
      <Field label={t.exercises.name} htmlFor="ex-name" error={errors.name}><Input id="ex-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.exercises.equipment} htmlFor="ex-eq"><NativeSelect id="ex-eq" value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })}>{Object.entries(t.exercises.equipmentTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
        <Field label={t.exercises.type} htmlFor="ex-type"><NativeSelect id="ex-type" value={f.exercise_type} onChange={(e) => setF({ ...f, exercise_type: e.target.value })}>{Object.entries(t.exercises.types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
        <Field label={t.exercises.pattern} htmlFor="ex-pat"><NativeSelect id="ex-pat" value={f.movement_pattern} onChange={(e) => setF({ ...f, movement_pattern: e.target.value })}>{Object.entries(t.exercises.patterns).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
      </div>
      <Field label={t.exercises.primaryMuscle} htmlFor="ex-pm"><NativeSelect id="ex-pm" value={f.primary} onChange={(e) => setF({ ...f, primary: Number(e.target.value) })}>{muscles.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect></Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">{t.exercises.secondaryMuscles}</legend>
        <div className="flex flex-wrap gap-1.5">
          {muscles.filter((m) => m.id !== f.primary).map((m) => {
            const on = f.secondary.includes(m.id);
            return <button key={m.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, secondary: on ? f.secondary.filter((x) => x !== m.id) : [...f.secondary, m.id] })} className={on ? "h-8 rounded-full bg-ink px-3 text-[13px] font-semibold text-white" : "h-8 rounded-full bg-subtle px-3 text-[13px] font-semibold text-muted hover:text-ink"}>{m.name}</button>;
          })}
        </div>
      </fieldset>
      <Field label={t.exercises.variationOf} htmlFor="ex-parent" optional>
        <NativeSelect id="ex-parent" value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}><option value="">–</option>{exercises.filter((x) => x.id !== exercise?.id && !x.parent_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect>
      </Field>
      <Field label={t.exercises.instructions} htmlFor="ex-ins" optional><Textarea id="ex-ins" rows={3} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
      <Field label={t.exercises.media} htmlFor="ex-media" help={t.exercises.mediaHelp} error={errors.media_url} optional><Input id="ex-media" type="url" value={f.media_url} onChange={(e) => setF({ ...f, media_url: e.target.value })} placeholder="https://" /></Field>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button><Button onClick={submit} loading={pending}>{t.common.save}</Button></div>
    </div>
  );
}
