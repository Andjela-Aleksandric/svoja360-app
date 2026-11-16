"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import type { MeasurementRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, InputWithUnit, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveMeasurementAction } from "@/app/actions/measurements";

const fields = [
  ["weight_kg", "kg"], ["waist_cm", "cm"], ["hips_cm", "cm"], ["chest_cm", "cm"], ["thigh_cm", "cm"], ["arm_cm", "cm"], ["body_fat_pct", "%"],
] as const;

const fmt = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));

export function MeasurementForm({ clientId, measurement, onDone }: { clientId: string; measurement?: MeasurementRow; onDone?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveMeasurementAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => {
    if (state?.ok) { toast(t.measurements.saved); onDone?.(); router.refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="client_id" value={clientId} />
      {measurement && <input type="hidden" name="id" value={measurement.id} />}
      <Field label={t.measurements.date} htmlFor="measured_on" error={errors.measured_on}>
        <Input id="measured_on" name="measured_on" type="date" max={todayISO()} defaultValue={measurement?.measured_on ?? todayISO()} required />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map(([name, unit]) => (
          <Field key={name} label={t.measurements[name]} htmlFor={`m-${name}`} error={errors[name]}>
            <InputWithUnit unit={unit} id={`m-${name}`} name={name} inputMode="decimal" defaultValue={fmt(measurement?.[name])} aria-invalid={!!errors[name]} />
          </Field>
        ))}
      </div>
      <Field label={t.measurements.notes} htmlFor="m-notes" optional>
        <Textarea id="m-notes" name="notes" rows={2} defaultValue={measurement?.notes ?? ""} />
      </Field>
      {state && !state.ok && !Object.keys(errors).length && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
        <Button type="submit" loading={pending}>{t.common.save}</Button>
      </div>
    </form>
  );
}
