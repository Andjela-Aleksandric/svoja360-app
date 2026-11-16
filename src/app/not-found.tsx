import Link from "next/link";
import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted">404</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{t.empty.notFoundTitle}</h1>
        <p className="mt-2 text-muted">{t.errors.notFound}</p>
        <Button asChild className="mt-6"><Link href="/">{t.empty.goHome}</Link></Button>
      </div>
    </main>
  );
}
