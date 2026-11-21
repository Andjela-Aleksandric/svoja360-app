"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Timer, X } from "lucide-react";
import { t } from "@/lib/i18n/sr";

export interface RestState { endsAt: number; total: number }

export function RestTimer({ rest, onChange }: { rest: RestState | null; onChange: (r: RestState | null) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rest) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, [rest]);
  const left = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && left === 0) {
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
      beep();
      const tm = setTimeout(() => onChange(null), 1500);
      return () => clearTimeout(tm);
    }
  }, [left, rest, onChange]);
  const pct = rest ? Math.min(100, ((rest.total - left) / rest.total) * 100) : 0;
  return (
    <AnimatePresence>
      {rest && (
        <motion.div role="timer" aria-live="polite" aria-label={t.workout.restTimer}
          initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          className="fixed inset-x-3 bottom-[calc(140px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md overflow-hidden rounded-[22px] bg-ink text-white shadow-[var(--shadow-pop)] md:bottom-24">
          <div className="absolute inset-y-0 left-0 bg-mint/30 transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
          <div className="relative flex items-center gap-3 px-4 py-3">
            <Timer className="size-5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-white/70">{left === 0 ? t.workout.restDone : t.workout.rest}</div>
              <div className="text-2xl font-extrabold tabular leading-none">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</div>
            </div>
            <button type="button" onClick={() => onChange({ endsAt: Math.max(Date.now() + 1000, rest.endsAt - 15000), total: Math.max(1, rest.total - 15) })} className="h-10 rounded-full bg-white/15 px-3 text-sm font-bold hover:bg-white/25">−15</button>
            <button type="button" onClick={() => onChange({ endsAt: rest.endsAt + 15000, total: rest.total + 15 })} className="h-10 rounded-full bg-white/15 px-3.5 text-sm font-bold hover:bg-white/25">+15</button>
            <button type="button" onClick={() => onChange(null)} aria-label={t.workout.restSkip} className="grid size-10 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X className="size-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Short double beep at the end of rest (works once the user has tapped the page). */
function beep() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    [0, 0.25].forEach((t0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 0.18);
      o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.2);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* no audio */ }
}
