import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CountUp } from "./count-up";
import { Words } from "./page-header";

/** Dark website-style "band" panel that opens a dashboard. */
export function HeroBand({ eyebrow, title, line, action, children, className }: { eyebrow?: React.ReactNode; title: string; line?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("band group relative isolate mb-6 overflow-hidden rounded-[28px] px-5 py-7 sm:px-9 sm:py-9", className)}>
      <span aria-hidden className="pointer-events-none absolute -right-32 -top-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(194,37,92,0.38),transparent)] transition-transform duration-[1.4s] will-change-transform group-hover:-translate-x-8 group-hover:translate-y-5" />
      <span aria-hidden className="pointer-events-none absolute -bottom-48 left-1/4 -z-10 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(142,214,184,0.22),transparent)] transition-transform duration-[1.4s] will-change-transform group-hover:translate-x-10" />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow eyebrow-line mb-3 text-band-muted">{eyebrow}</div>}
          <h1 className="font-display text-[34px] leading-[1.06] sm:text-[50px]"><Words text={title} /></h1>
          {line && <p className="mt-3 max-w-xl animate-rise text-[15px] leading-relaxed text-band-muted [animation-delay:250ms]">{line}</p>}
        </div>
        {action && <div className="flex shrink-0 animate-rise flex-wrap gap-2 [animation-delay:200ms]">{action}</div>}
      </div>
      {children && <div className="mt-7 sm:mt-9">{children}</div>}
    </section>
  );
}

/** One big number inside a HeroBand. */
export function HeroStat({ label, value, hint, href, accent, children }: { label: string; value: number | string; hint?: React.ReactNode; href?: string; accent?: "rasp" | "mint"; children?: React.ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-[10px] text-band-muted">{label}</span>
        {href && <ArrowUpRight className="size-4 text-band-muted transition-all duration-300 group-hover/hs:-translate-y-0.5 group-hover/hs:translate-x-0.5 group-hover/hs:text-mint" />}
      </div>
      <div className={cn("mt-3 font-display text-[46px] leading-none tabular sm:text-[56px]", accent === "rasp" && "text-[#ff6b9a]", accent === "mint" && "text-mint")}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="mt-2 text-[13px] text-band-muted">{hint}</div>}
      {children}
    </>
  );
  const cls = "group/hs relative rounded-[20px] border border-band-line bg-white/[0.04] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-mint/50 hover:bg-white/[0.06] sm:p-5";
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Tiny bar meter used in tables: done vs planned. */
export function Meter({ value, max, tone = "mint", className }: { value: number; max: number; tone?: "mint" | "rasp" | "ink"; className?: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <span className={cn("relative block h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} aria-hidden>
      <span className={cn("absolute inset-y-0 left-0 origin-left animate-[meter_.9s_cubic-bezier(.2,.7,.2,1)_both] rounded-full", tone === "mint" ? "bg-mint-ink" : tone === "rasp" ? "bg-accent" : "bg-ink")} style={{ width: `${pct}%` }} />
    </span>
  );
}
