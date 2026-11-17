"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const show = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

/** Compact numeric cell. Accepts decimal comma; commits on blur or Enter. */
export function NumCell({ value, onChange, min, max, step, integer, label, className, placeholder }: { value: number | null; onChange: (v: number | null) => void; min: number; max: number; step?: number; integer?: boolean; label: string; className?: string; placeholder?: string }) {
  const [raw, setRaw] = useState(show(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setRaw(show(value)), [value]);
  const commit = () => {
    const s = raw.trim().replace(",", ".");
    if (s === "") { setBad(false); if (value !== null) onChange(null); return; }
    let n = Number(s);
    if (!Number.isFinite(n) || n < min || n > max) { setBad(true); return; }
    if (integer) n = Math.round(n);
    if (step) n = Math.round(n / step) * step;
    setBad(false);
    if (n !== value) onChange(Number(n.toFixed(2)));
  };
  return (
    <input
      aria-label={label} title={label} inputMode={integer ? "numeric" : "decimal"} value={raw} placeholder={placeholder}
      onChange={(e) => setRaw(e.target.value.replace(/[^0-9.,]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur())}
      aria-invalid={bad || undefined}
      className={cn("h-9 w-full min-w-0 rounded-[10px] border border-line bg-surface px-2 text-center text-[15px] font-semibold tabular outline-none transition-colors focus:border-ink md:text-sm", bad && "border-danger bg-danger-soft", className)}
    />
  );
}
