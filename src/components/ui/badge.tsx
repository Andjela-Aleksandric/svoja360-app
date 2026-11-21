import * as React from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  neutral: "bg-subtle text-ink-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-mint-soft text-mint-ink",
  mint: "bg-mint text-ink",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  outline: "border border-line text-muted",
  dark: "bg-ink text-white",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 leading-tight sm:whitespace-nowrap font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
