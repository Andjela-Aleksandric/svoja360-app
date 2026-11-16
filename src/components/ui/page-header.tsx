import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({ title, description, action, eyebrow, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-semibold text-muted">{eyebrow}</div>}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] border border-line bg-surface p-5 shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-muted">{label}</span>
        {icon && <span className="text-faint [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="mt-2 text-[28px] font-extrabold leading-none tracking-tight tabular text-ink">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
