"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatDuration, formatPace, parseDuration, parsePace } from "@/lib/utils/running";

/** Text cell for pace (m:ss per km) or duration (h:mm:ss). Commits on blur. */
export function TimeCell({ value, onChange, kind, label, placeholder, min, max, className }: { value: number | null; onChange: (v: number | null) => void; kind: "pace" | "duration"; label: string; placeholder?: string; min?: number; max?: number; className?: string }) {
  const show = (v: number | null) => (v == null ? "" : kind === "pace" ? formatPace(v) : formatDuration(v));
  const [raw, setRaw] = useState(show(value));
  const [bad, setBad] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setRaw(show(value)), [value]);
  const commit = () => {
    if (!raw.trim()) { setBad(false); if (value !== null) onChange(null); return; }
    const v = kind === "pace" ? parsePace(raw) : parseDuration(raw);
    if (v == null || (min != null && v < min) || (max != null && v > max)) { setBad(true); return; }
    setBad(false);
    if (v !== value) onChange(v);
  };
  return (
    <input aria-label={label} title={label} value={raw} placeholder={placeholder ?? (kind === "pace" ? "5:30" : "10:00")} inputMode="numeric"
      onChange={(e) => setRaw(e.target.value.replace(/[^0-9:.]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-invalid={bad || undefined}
      className={cn("h-9 w-full min-w-0 rounded-[10px] border border-line bg-surface px-2 text-center text-[15px] font-semibold tabular outline-none focus:border-ink md:text-sm", bad && "border-danger bg-danger-soft", className)} />
  );
}
