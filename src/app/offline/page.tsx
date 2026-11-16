import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { t } from "@/lib/i18n/sr";

export const dynamic = "force-static";
export const metadata = { title: t.pwa.offlineTitle };

export default function OfflinePage() {
  return (
    <main id="sadrzaj" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <Logo size={28} className="mb-8 justify-center" />
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-subtle"><WifiOff className="size-6 text-muted" /></div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.pwa.offlineTitle}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{t.pwa.offlineBody}</p>
        <a href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">{t.common.retry}</a>
      </div>
    </main>
  );
}
