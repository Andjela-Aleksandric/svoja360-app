"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("greska") === "link" ? t.auth.linkExpired : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) {
      setLoading(false);
      setError(error.message.toLowerCase().includes("invalid") ? t.auth.invalidCredentials : t.errors.generic);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.auth.signInTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.auth.signInSubtitle}</p>
      </div>
      <Field label={t.auth.email} htmlFor="email">
        <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-[12px] bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" loading={loading} disabled={!email || !password}>
        {loading ? t.auth.signingIn : t.auth.signIn}
      </Button>
      <Link href="/zaboravljena-lozinka" className="text-center text-sm font-semibold text-muted hover:text-ink">
        {t.auth.forgotPassword}
      </Link>
    </form>
  );
}
