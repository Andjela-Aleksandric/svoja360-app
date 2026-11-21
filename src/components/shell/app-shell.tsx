"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard, Users, Dumbbell, Footprints, Apple, ClipboardCheck, BookOpen, Carrot, Settings,
  Home, LineChart, UserRound, MoreHorizontal, LogOut, X, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { t } from "@/lib/i18n/sr";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import type { IconName, NavItem } from "./nav-config";
import { coachNav, clientNav, SIDEBAR_COOKIE } from "./nav-config";

const icons: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, users: Users, dumbbell: Dumbbell, running: Footprints, apple: Apple,
  clipboard: ClipboardCheck, library: BookOpen, carrot: Carrot, settings: Settings, home: Home,
  chart: LineChart, user: UserRound, more: MoreHorizontal,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

export function AppShell({ role, userName, badges, collapsed: initialCollapsed = false, children }: { role: "coach" | "client"; userName: string | null; badges?: Record<string, number>; collapsed?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const nav = role === "coach" ? coachNav : clientNav;
  const primary = nav.filter((n) => n.primary);
  const secondary = nav.filter((n) => !n.primary);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const moreActive = secondary.some((s) => isActive(pathname, s));
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);
  // Ctrl/Cmd + B toggles the sidebar, like most desktop apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggle(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className={cn("min-h-dvh md:grid md:transition-[grid-template-columns] md:duration-300 md:ease-[cubic-bezier(.2,.7,.2,1)]", collapsed ? "md:grid-cols-[84px_1fr]" : "md:grid-cols-[256px_1fr]")}>
      {/* Desktop sidebar */}
      <aside className={cn("band sticky top-0 z-30 hidden h-dvh flex-col bg-band py-5 text-band-fg md:flex", collapsed ? "px-3" : "px-3")}>
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -right-28 -top-28 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(194,37,92,0.28),transparent)]" />
          <span className="absolute -bottom-32 -left-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgba(142,214,184,0.16),transparent)]" />
        </span>
        <div className={cn("relative mb-6 flex items-center", collapsed ? "flex-col gap-3" : "justify-between pl-3")}>
          <Link href={role === "coach" ? "/trener" : "/klijent"} title="SVOJA 360"><Logo size={26} inverted withText={!collapsed} /></Link>
          <button type="button" onClick={toggle} aria-label={collapsed ? t.nav.expand : t.nav.collapse} aria-expanded={!collapsed} title={`${collapsed ? t.nav.expand : t.nav.collapse} (Ctrl+B)`}
            className="grid size-9 place-items-center rounded-full text-band-muted transition-colors hover:bg-band-2 hover:text-mint">
            <ToggleIcon className="size-[18px]" />
          </button>
        </div>
        <nav className="relative grid gap-1" aria-label={t.nav.menu}>
          {nav.map((item) => {
            const Icon = icons[item.icon];
            const on = isActive(pathname, item);
            const count = badges?.[item.href];
            return (
              <Link key={item.href} href={item.href} aria-current={on ? "page" : undefined} aria-label={collapsed ? item.label : undefined}
                className={cn("group/nav relative flex h-11 items-center gap-3 rounded-[14px] text-[15px] font-semibold transition-colors", collapsed ? "justify-center px-0" : "px-3", on ? "text-band" : "text-band-muted hover:bg-band-2 hover:text-band-fg")}>
                {on && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-[14px] bg-mint" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-[19px] shrink-0 transition-transform duration-200 group-hover/nav:scale-110" />
                {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                {count ? <span className={cn("grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white tabular", collapsed ? "absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]" : "relative")}>{count}</span> : null}
                {collapsed && (
                  <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-[10px] bg-ink px-3 py-1.5 text-[13px] font-semibold text-white opacity-0 shadow-[var(--shadow-pop)] transition-all duration-150 group-hover/nav:translate-x-0 group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={cn("relative mt-auto flex items-center rounded-[16px] border border-band-line bg-band-2", collapsed ? "flex-col gap-2 p-2" : "gap-3 p-2.5")}>
          <Avatar name={userName} size={34} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{userName ?? ""}</div>
              <div className="text-xs text-band-muted">{role === "coach" ? t.roles.coach : t.roles.client}</div>
            </div>
          )}
          <form action="/auth/odjava" method="post" onSubmit={clearUserCache}>
            <button type="submit" aria-label={t.common.signOut} title={t.common.signOut} className="grid size-8 place-items-center rounded-full text-band-muted transition-colors hover:bg-accent hover:text-white">
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

      <main id="sadrzaj" className="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:px-8 md:pb-16 md:pt-9 xl:px-12">
        <div className={cn("mx-auto w-full transition-[max-width] duration-300", collapsed ? "max-w-[1320px]" : "max-w-[1200px]")}>{children}</div>
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
