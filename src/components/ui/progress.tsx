"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

export function ProgressBar({ value, max = 100, className, tone = "ink", label }: { value: number; max?: number; className?: string; tone?: "ink" | "accent" | "success"; label?: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const reduce = useReducedMotion();
  const color = tone === "accent" ? "bg-accent" : tone === "success" ? "bg-success" : "bg-ink";
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-subtle", className)}>
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </div>
  );
}

export function ProgressRing({ value, max = 100, size = 64, stroke = 6, children, tone = "accent" }: { value: number; max?: number; size?: number; stroke?: number; children?: React.ReactNode; tone?: "accent" | "ink" | "success" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const reduce = useReducedMotion();
  const color = tone === "accent" ? "var(--color-accent)" : tone === "success" ? "var(--color-success)" : "var(--color-ink)";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-subtle)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
