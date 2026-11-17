"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveDeadlineAction, saveProfileAction } from "./actions";

function useResult(state: ActionResult | null) {
  const router = useRouter();
  const { toast } = useToast();
  useEffect(() => {
    if (state?.ok) { toast(t.settings.saved); router.refresh(); }
    else if (state && !state.fieldErrors) toast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function DeadlineForm({ weekday, hour }: { weekday: number; hour: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveDeadlineAction, null);
  useResult(state);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <Field label={t.settings.weekday} htmlFor="weekday">
        <NativeSelect id="weekday" name="weekday" defaultValue={weekday}>
          {t.weekdays.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
        </NativeSelect>
      </Field>
      <Field label={t.settings.hour} htmlFor="hour">
        <NativeSelect id="hour" name="hour" defaultValue={hour}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
        </NativeSelect>
      </Field>
      <Button type="submit" loading={pending}>{t.common.save}</Button>
    </form>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveProfileAction, null);
  useResult(state);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.settings.fullName} htmlFor="full_name" error={errors.full_name}><Input id="full_name" name="full_name" defaultValue={fullName} required /></Field>
        <Field label={t.settings.phone} htmlFor="phone" error={errors.phone}><Input id="phone" name="phone" type="tel" defaultValue={phone} placeholder="+381 64 123 4567" /></Field>
      </div>
      <div className="flex justify-end"><Button type="submit" loading={pending}>{t.common.save}</Button></div>
    </form>
  );
}
