"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRow } from "@/lib/data/types";
import type { ActionResult } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, InputWithUnit, NativeSelect, Textarea } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/choice";
import { useToast } from "@/components/ui/toast";
import { createClientAction, updateClientAction } from "./actions";

type State = ActionResult<{ id: string; inviteFailed: boolean }> | ActionResult | null;

export function ClientForm({ client, onDone }: { client?: ClientRow; onDone?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [invite, setInvite] = useState(true);
  const [state, action, pending] = useActionState<State, FormData>(
    (prev, fd) => (client ? updateClientAction(prev, fd) : createClientAction(prev, fd)),
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (!state?.ok) return;
    if (client) {
      toast(t.clients.updated, "success");
      onDone?.();
      router.refresh();
    } else {
      const data = (state as { data: { id: string; inviteFailed: boolean } }).data;
      toast(data.inviteFailed ? t.errors.inviteFailed : invite ? `${t.clients.created} ${t.clients.account.inviteSent}` : t.clients.created, data.inviteFailed ? "error" : "success");
      router.push(`/trener/klijenti/${data.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="grid gap-5" noValidate>
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.clients.fields.fullName} htmlFor="full_name" error={errors.full_name} className="sm:col-span-2">
          <Input id="full_name" name="full_name" required autoComplete="off" defaultValue={client?.full_name} aria-invalid={!!errors.full_name} />
        </Field>
        <Field label={t.clients.fields.email} htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" inputMode="email" required autoComplete="off" defaultValue={client?.email} aria-invalid={!!errors.email} />
        </Field>
        <Field label={t.clients.fields.phone} htmlFor="phone" help={t.clients.fields.phoneHelp} error={errors.phone} optional>
          <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+381 64 123 4567" defaultValue={client?.phone_e164 ?? client?.phone ?? ""} aria-invalid={!!errors.phone} />
        </Field>
        <Field label={t.clients.fields.birthDate} htmlFor="birth_date" error={errors.birth_date} optional>
          <Input id="birth_date" name="birth_date" type="date" max={todayISO()} defaultValue={client?.birth_date ?? ""} />
        </Field>
        <Field label={t.clients.fields.height} htmlFor="height_cm" error={errors.height_cm} optional>
          <InputWithUnit unit="cm" id="height_cm" name="height_cm" inputMode="decimal" defaultValue={client?.height_cm != null ? String(client.height_cm).replace(".", ",") : ""} />
        </Field>
        <Field label={t.clients.fields.startDate} htmlFor="start_date" error={errors.start_date}>
          <Input id="start_date" name="start_date" type="date" required defaultValue={client?.start_date ?? todayISO()} />
        </Field>
        {client && (
          <Field label={t.clients.fields.status} htmlFor="status">
            <NativeSelect id="status" name="status" defaultValue={client.status}>
              <option value="active">{t.clients.status.active}</option>
              <option value="inactive">{t.clients.status.inactive}</option>
              <option value="archived">{t.clients.status.archived}</option>
            </NativeSelect>
          </Field>
        )}
        <Field label={t.clients.fields.goal} htmlFor="goal" error={errors.goal} optional className="sm:col-span-2">
          <Textarea id="goal" name="goal" rows={3} defaultValue={client?.goal ?? ""} />
        </Field>
      </div>
      {!client && (
        <CheckboxField id="send_invite" name="send_invite" checked={invite} onCheckedChange={setInvite} label={t.clients.fields.sendInvite} description={t.clients.newSubtitle} />
      )}
      {state && !state.ok && !Object.keys(errors).length && (
        <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.error}</p>
      )}
      <div className="flex justify-end gap-2">
        {onDone && <Button type="button" variant="ghost" onClick={onDone}>{t.common.cancel}</Button>}
        <Button type="submit" loading={pending}>{client ? t.common.saveChanges : t.clients.add}</Button>
      </div>
    </form>
  );
}
