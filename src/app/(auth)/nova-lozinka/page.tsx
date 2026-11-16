"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function NewPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError(t.validation.minLength(8)); return; }
    if (password !== confirm) { setError(t.auth.passwordsDontMatch); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message.includes("session") ? t.auth.linkExpired : t.errors.generic); return; }
    toast(t.auth.passwordUpdated);
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.auth.newPasswordTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.auth.newPasswordSubtitle}</p>
      </div>
      <Field label={t.auth.newPassword} htmlFor="password">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirm" error={error}>
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!error} />
      </Field>
      <Button type="submit" size="lg" loading={loading}>{t.auth.setPassword}</Button>
    </form>
  );
}
