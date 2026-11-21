import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "animate-rise rounded-[24px] border border-line bg-surface shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300 hover:border-line-strong",
        interactive && "lift blob hover:border-ink",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, title, description, action }: { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[17.5px] font-bold leading-snug tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13.5px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...props} />;
}
