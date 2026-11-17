"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { t } from "@/lib/i18n/sr";
import type { Question } from "@/lib/questionnaire/logic";
import { Input, InputWithUnit, Textarea } from "@/components/ui/input";
import { CheckboxField, RadioCards } from "@/components/ui/choice";

const toText = (n: unknown) => (typeof n === "number" ? String(n).replace(".", ",") : "");
const parseNum = (s: string): number | null => {
  const clean = s.replace(/\s/g, "").replace(",", ".");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
};

export function NumberField({ id, value, onChange, unit, step, min, max, integer, invalid, placeholder }: { id: string; value: unknown; onChange: (v: number | null) => void; unit?: string | null; step?: number; min?: number; max?: number; integer?: boolean; invalid?: boolean; placeholder?: string }) {
  const [raw, setRaw] = useState(toText(value));
  useEffect(() => { if (parseNum(raw) !== value && !(value == null && raw === "")) setRaw(toText(value)); /* external change */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const props = {
    id, value: raw, inputMode: (integer ? "numeric" : "decimal") as "numeric" | "decimal", placeholder, "aria-invalid": invalid || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const s = e.target.value.replace(/[^0-9.,\-]/g, "");
      setRaw(s);
      const n = parseNum(s);
      onChange(n === null ? null : Number.isNaN(n) ? (Number.NaN as number) : n);
    },
    "data-min": min, "data-max": max, "data-step": step,
  };
  return unit ? <InputWithUnit unit={unit} {...props} /> : <Input {...props} />;
}

export function ScaleField({ id, value, onChange, min = 1, max = 10, minLabel, maxLabel }: { id: string; value: unknown; onChange: (v: number) => void; min?: number; max?: number; minLabel?: string; maxLabel?: string }) {
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }}>
        {nums.map((n) => {
          const on = value === n;
          return (
            <button key={n} type="button" role="radio" aria-checked={on} onClick={() => onChange(n)}
              className={cn("h-11 rounded-[12px] border text-[15px] font-bold tabular transition-all", on ? "scale-[1.04] border-ink bg-ink text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong")}>
              {n}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="mt-1.5 flex justify-between gap-4 text-xs text-muted"><span>{minLabel}</span><span className="text-right">{maxLabel}</span></div>
      )}
    </div>
  );
}

export function YesNoField({ id, value, onChange }: { id: string; value: unknown; onChange: (v: boolean) => void }) {
  return (
    <RadioCards name={id} columns={2} value={value === true ? "yes" : value === false ? "no" : ""} onValueChange={(v) => onChange(v === "yes")}
      options={[{ value: "yes", label: t.common.yes }, { value: "no", label: t.common.no }]} />
  );
}

export function MultiChoiceField({ id, value, onChange, choices }: { id: string; value: unknown; onChange: (v: string[]) => void; choices: string[] }) {
  const sel = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {choices.map((c, i) => (
        <CheckboxField key={c} id={`${id}-${i}`} checked={sel.includes(c)} label={c}
          onCheckedChange={(on) => onChange(on ? [...sel, c] : sel.filter((x) => x !== c))} />
      ))}
    </div>
  );
}

export function PlannedDoneField({ id, value, onChange }: { id: string; value: unknown; onChange: (v: { planned: number | null; done: number | null }) => void }) {
  const v = (value as { planned?: number | null; done?: number | null }) ?? {};
  const stepper = (key: "planned" | "done", label: string) => {
    const cur = v[key] ?? null;
    const set = (n: number | null) => onChange({ planned: v.planned ?? null, done: v.done ?? null, [key]: n });
    return (
      <div className="rounded-[14px] border border-line bg-surface p-3">
        <div id={`${id}-${key}`} className="mb-2 text-[13px] font-semibold text-muted">{label}</div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="−" onClick={() => set(Math.max(0, (cur ?? 0) - 1))} className="grid size-10 place-items-center rounded-full bg-subtle text-lg font-bold hover:bg-line">−</button>
          <span aria-labelledby={`${id}-${key}`} className="min-w-8 text-center text-2xl font-extrabold tabular">{cur ?? "–"}</span>
          <button type="button" aria-label="+" onClick={() => set(Math.min(21, (cur ?? 0) + 1))} className="grid size-10 place-items-center rounded-full bg-subtle text-lg font-bold hover:bg-line">+</button>
        </div>
      </div>
    );
  };
  return <div className="grid grid-cols-2 gap-3">{stepper("planned", t.questionnaire.plannedLabel)}{stepper("done", t.questionnaire.doneLabel)}</div>;
}

export function MeasurementsField({ id, value, onChange, fields }: { id: string; value: unknown; onChange: (v: Record<string, number | null>) => void; fields: string[] }) {
  const v = (value as Record<string, number | null>) ?? {};
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {fields.map((f) => (
        <label key={f} className="grid gap-1.5">
          <span className="text-[13px] font-semibold">{(t.questionnaire.measurements as Record<string, string>)[f] ?? f}</span>
          <NumberField id={`${id}-${f}`} value={v[f]} unit="cm" onChange={(n) => onChange({ ...v, [f]: n })} />
        </label>
      ))}
    </div>
  );
}

export function BasicField({ q, value, onChange, invalid }: { q: Question; value: unknown; onChange: (v: unknown) => void; invalid?: boolean }) {
  const o = q.options ?? {};
  const id = `q-${q.id}`;
  switch (q.type) {
    case "text":
      return <Input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} type={o.format === "email" ? "email" : "text"} aria-invalid={invalid || undefined} maxLength={500} />;
    case "long_text":
      return <Textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} aria-invalid={invalid || undefined} maxLength={5000} className="min-h-[110px]" />;
    case "number":
      return <NumberField id={id} value={value} onChange={onChange} unit={q.unit} step={o.step} min={o.min} max={o.max} invalid={invalid} />;
    case "date":
      return <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />;
    case "single_choice": {
      const choices = o.choices ?? [];
      const short = choices.every((c) => c.length <= 14);
      return <RadioCards name={id} value={(value as string) ?? ""} onValueChange={onChange} columns={short && choices.length > 2 ? 3 : choices.length === 2 ? 2 : 1} options={choices.map((c) => ({ value: c, label: c }))} />;
    }
    case "multi_choice":
      return <MultiChoiceField id={id} value={value} onChange={onChange} choices={o.choices ?? []} />;
    case "scale":
      return <ScaleField id={id} value={value} onChange={onChange} min={o.min} max={o.max} minLabel={o.minLabel} maxLabel={o.maxLabel} />;
    case "yes_no":
      return <YesNoField id={id} value={value} onChange={onChange} />;
    case "planned_done":
      return <PlannedDoneField id={id} value={value} onChange={onChange} />;
    case "measurements":
      return <MeasurementsField id={id} value={value} onChange={onChange} fields={o.fields ?? []} />;
    default:
      return null;
  }
}
