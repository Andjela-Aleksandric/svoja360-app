import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { CountUp } from "./count-up";

/** Splits a plain-text title into words that rise in one by one (CSS only). */
export function Words({ text }: { text: string }) {
  return (
    <span className="words">
      {text.split(" ").map((w, i) => (
        <React.Fragment key={i}>
          <span className="w" style={{ "--w": i } as React.CSSProperties}>{w}</span>{" "}
        </React.Fragment>
      ))}
    </span>
  );
}

export function PageHeader({ title, description, action, eyebrow, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow eyebrow-line mb-3">{eyebrow}</div>}
        <h1 className="font-display text-[36px] leading-[1.06] text-ink sm:text-[48px]">{typeof title === "string" ? <Words text={title} /> : title}</h1>
        {description && <p className="mt-2.5 max-w-2xl animate-rise text-[15px] leading-relaxed text-muted [animation-delay:200ms]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 animate-rise flex-wrap items-center gap-2 [animation-delay:150ms]">{action}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, icon, className, tone = "rasp" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; className?: string; tone?: "rasp" | "mint" }) {
  return (
    <div className={cn("group/stat lift blob rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-ink", tone === "mint" && "blob-mint", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {icon && <span className="text-faint transition-all duration-500 group-hover/stat:rotate-[-8deg] group-hover/stat:scale-110 group-hover/stat:text-accent [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-3 font-display text-[42px] leading-none tabular text-ink">{typeof value === "string" || typeof value === "number" ? <CountUp value={value} /> : value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[19px] font-bold leading-snug tracking-[-0.01em]">{children}</h2>
      {action}
    </div>
  );
}
