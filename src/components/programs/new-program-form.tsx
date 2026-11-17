"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Action = (prev: unknown, fd: FormData) => Promise<ActionResult<{ id: string }>>;

export function NewProgramForm({ action, basePath, clients, templates, defaultClient, withWeeks, extra }: {
  action: Action; basePath: string; clients: { id: string; full_name: string }[]; templates: { id: string; label: string }[];
  defaultClient?: string; withWeeks?: boolean; extra?: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState<ActionResult<{ id: string }> | null, FormData>(action, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  useEffect(() => {
    if (state?.ok) router.push(`${basePath}/${state.data.id}`);
    else if (state && !state.ok && !state.fieldErrors) toast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className="grid gap-5">
      <Field label={t.strength.programName} htmlFor="name" error={errors.name}><Input id="name" name="name" required maxLength={120} /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.strength.client} htmlFor="client_id">
          <NativeSelect id="client_id" name="client_id" defaultValue={defaultClient ?? ""}>
            <option value="">{t.strength.noClient}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t.strength.startDate} htmlFor="start_date" optional><Input id="start_date" name="start_date" type="date" /></Field>
        <Field label={t.strength.fromTemplate} htmlFor="template_id">
          <NativeSelect id="template_id" name="template_id" defaultValue="">
            <option value="">{t.strength.noTemplate}</option>
            {templates.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </NativeSelect>
        </Field>
        {withWeeks && <Field label={t.strength.weeksCount} htmlFor="weeks" error={errors.weeks}><Input id="weeks" name="weeks" type="number" min={1} max={52} defaultValue={4} inputMode="numeric" /></Field>}
      </div>
      {extra}
      <div className="flex justify-end"><Button type="submit" loading={pending}>{t.common.create}</Button></div>
    </form>
  );
}
