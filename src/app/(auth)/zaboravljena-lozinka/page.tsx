"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t.validation.email); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/nova-lozinka`,
    });
    // Same message whether or not the account exists.
    setLoading(false);
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.auth.resetTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.auth.resetSubtitle}</p>
      </div>
      {sent ? (
        <p role="status" className="rounded-[12px] bg-success-soft px-3.5 py-3 text-sm font-medium text-success">{t.auth.resetSent}</p>
      ) : (
        <>
          <Field label={t.auth.email} htmlFor="email" error={error}>
            <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} />
          </Field>
          <Button type="submit" size="lg" loading={loading}>{t.auth.sendResetLink}</Button>
        </>
      )}
      <Link href="/prijava" className="text-center text-sm font-semibold text-muted hover:text-ink">{t.auth.backToSignIn}</Link>
    </form>
  );
}
