"use client";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-extrabold tracking-tight">{t.errors.generic}</h1>
        <Button className="mt-6" onClick={() => reset()}>{t.common.retry}</Button>
      </div>
    </main>
  );
}
