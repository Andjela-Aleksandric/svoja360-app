import { t } from "@/lib/i18n/sr";
import { Logo } from "@/components/brand/logo";
import { HashSessionHandler } from "./hash-session";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="sadrzaj" className="grid min-h-dvh place-items-center px-5 py-10 safe-top">
      <HashSessionHandler />
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={44} />
          <p className="text-[13px] font-medium text-muted">{t.app.tagline}</p>
        </div>
        <div className="rounded-[24px] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">{children}</div>
      </div>
    </main>
  );
}
