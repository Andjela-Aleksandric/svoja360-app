"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard, Users, Dumbbell, Footprints, Apple, ClipboardCheck, BookOpen, Carrot, Settings,
  Home, LineChart, UserRound, MoreHorizontal, LogOut, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { t } from "@/lib/i18n/sr";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import type { IconName, NavItem } from "./nav-config";
import { coachNav, clientNav } from "./nav-config";

const icons: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, users: Users, dumbbell: Dumbbell, running: Footprints, apple: Apple,
  clipboard: ClipboardCheck, library: BookOpen, carrot: Carrot, settings: Settings, home: Home,
  chart: LineChart, user: UserRound, more: MoreHorizontal,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({ role, userName, badges, children }: { role: "coach" | "client"; userName: string | null; badges?: Record<string, number>; children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = role === "coach" ? coachNav : clientNav;
  const primary = nav.filter((n) => n.primary);
  const secondary = nav.filter((n) => !n.primary);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = secondary.some((s) => isActive(pathname, s));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur md:flex">
        <Link href={role === "coach" ? "/trener" : "/klijent"} className="mb-7 px-3 [&_svg]:transition-transform [&_svg]:duration-700 hover:[&_svg]:rotate-[360deg]"><Logo size={26} /></Link>
        <nav className="grid gap-0.5" aria-label={t.nav.menu}>
          {nav.map((item) => {
            const Icon = icons[item.icon];
            const on = isActive(pathname, item);
            const count = badges?.[item.href];
            return (
              <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined}
                className={cn("group relative flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold transition-colors", on ? "text-ink" : "text-muted hover:bg-hover hover:text-ink")}>
                {on && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-[12px] bg-subtle" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-[18px] transition-transform duration-200 group-hover:scale-110" />
                <span className="relative flex-1">{item.label}</span>
                {count ? <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white tabular">{count}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-[14px] border border-line bg-surface p-2.5">
          <Avatar name={userName} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{userName ?? ""}</div>
            <div className="text-xs text-muted">{role === "coach" ? t.roles.coach : t.roles.client}</div>
          </div>
          <form action="/auth/odjava" method="post" onSubmit={clearUserCache}>
            <button type="submit" aria-label={t.common.signOut} title={t.common.signOut} className="grid size-8 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-bg/85 px-4 backdrop-blur-md safe-top md:hidden">
        <Link href={role === "coach" ? "/trener" : "/klijent"}><Logo size={22} /></Link>
        <Avatar name={userName} size={30} />
      </header>

      <main id="sadrzaj" className="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:px-10 md:pb-16 md:pt-10">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label={t.nav.menu} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-md safe-bottom md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5">
          {primary.map((item) => {
            const Icon = icons[item.icon];
            const on = isActive(pathname, item);
            const count = badges?.[item.href];
            return (
              <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition-transform active:scale-90">
                <span className={cn("relative grid h-8 w-12 place-items-center rounded-full transition-colors", on ? "text-white" : "text-muted")}>
                  {on && <motion.span layoutId="bottom-active" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <Icon className="relative size-[19px]" />
                  {count ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{count}</span> : null}
                </span>
                <span className={cn("max-w-full truncate px-1", on ? "text-ink" : "text-muted")}>{shortLabel(item.label)}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex flex-col items-center justify-center gap-1 text-[10.5px] font-semibold">
            <span className={cn("grid h-8 w-12 place-items-center rounded-full", moreActive ? "bg-ink text-white" : "text-muted")}><MoreHorizontal className="size-[19px]" /></span>
            <span className={moreActive ? "text-ink" : "text-muted"}>{t.common.more}</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-ink/30 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} />
            <motion.div
              role="dialog" aria-modal="true" aria-label={t.nav.menu}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-pop)] md:hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-bold">{t.nav.menu}</span>
                <button onClick={() => setMoreOpen(false)} aria-label={t.common.close} className="grid size-9 place-items-center rounded-full text-muted hover:bg-hover"><X className="size-4" /></button>
              </div>
              <div className="grid gap-1">
                {secondary.map((item) => {
                  const Icon = icons[item.icon];
                  const on = isActive(pathname, item);
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex h-12 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold transition-colors active:scale-[0.98]", on ? "bg-subtle text-ink" : "text-ink-2 hover:bg-hover")}>
                      <Icon className="size-5 text-muted" /> {item.label}
                      {badges?.[item.href] ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{badges[item.href]}</span> : null}
                    </Link>
                  );
                })}
                <form action="/auth/odjava" method="post" onSubmit={clearUserCache}>
                  <button type="submit" className="flex h-12 w-full items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold text-ink-2 hover:bg-hover">
                    <LogOut className="size-5 text-muted" /> {t.common.signOut}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function clearUserCache() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_USER_CACHE" });
  } catch {}
}

function shortLabel(label: string) {
  const map: Record<string, string> = {
    [t.nav.coach.dashboard]: "Pregled",
    [t.nav.coach.checkins]: "Izveštaji",
    [t.nav.coach.strength]: "Snaga",
    [t.nav.client.workouts]: "Treninzi",
  };
  return map[label] ?? label;
}

export { coachNav, clientNav };
