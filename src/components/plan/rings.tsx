"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils/cn";

export interface Ring { value: number | null; color: string; label: string }

export { RING_COLORS } from "./ring-colors";

/**
 * Three concentric progress rings (strength outside, cardio, food inside).
 * Each fills as the week goes on; a value of 1 closes the ring, above 1 keeps going for a second lap.
 */
export function Rings({ rings, size = 200, stroke, gap, track = "rgba(255,255,255,0.09)", className, delay = 0 }: {
  rings: Ring[]; size?: number; stroke?: number; gap?: number; track?: string; className?: string; delay?: number;
}) {
  const reduce = useReducedMotion();
  const sw = stroke ?? Math.max(4, Math.round(size * 0.1));
  const g = gap ?? Math.max(1.5, Math.round(sw * 0.18));
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0 -rotate-90", className)} role="img"
      aria-label={rings.map((r) => `${r.label}: ${r.value == null ? "–" : `${Math.round(r.value * 100)}%`}`).join(", ")}>
      {rings.map((r, i) => {
        const radius = c - sw / 2 - i * (sw + g);
        if (radius <= sw / 2) return null;
        const len = 2 * Math.PI * radius;
        const v = r.value ?? 0;
        const first = Math.min(1, v), extra = Math.max(0, Math.min(1, v - 1));
        return (
          <g key={i}>
            {r.value == null
              ? <circle cx={c} cy={c} r={radius} fill="none" stroke={track} strokeWidth={sw} />
              : <circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeOpacity={0.18} strokeWidth={sw} />}
            {r.value != null && first > 0 && (
              <motion.circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={len}
                initial={reduce ? false : { strokeDashoffset: len }} animate={{ strokeDashoffset: len * (1 - first) }}
                transition={{ duration: 1.1, delay: delay + i * 0.12, ease: [0.2, 0.7, 0.2, 1] }} />
            )}
            {extra > 0 && (
              <motion.circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={len}
                style={{ filter: "brightness(1.25) drop-shadow(0 0 2px rgba(0,0,0,0.6))" }}
                initial={reduce ? false : { strokeDashoffset: len }} animate={{ strokeDashoffset: len * (1 - extra) }}
                transition={{ duration: 0.9, delay: delay + 1 + i * 0.12, ease: [0.2, 0.7, 0.2, 1] }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
