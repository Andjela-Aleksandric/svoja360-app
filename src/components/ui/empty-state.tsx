import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[20px] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full bg-subtle text-muted [&_svg]:size-5">{icon}</div>}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-[20px] border border-danger/20 bg-danger-soft px-6 py-8 text-center">
      <p className="text-sm font-semibold text-danger">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
