import { t } from "@/lib/i18n/sr";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NoAccessPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mb-6 flex justify-center"><Logo size={40} /></div>
        <p className="text-[15px] text-ink-2">{t.auth.noAccess}</p>
        <form action="/auth/odjava" method="post" className="mt-6">
          <Button variant="secondary" type="submit">{t.common.signOut}</Button>
        </form>
      </div>
    </main>
  );
}
