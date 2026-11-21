import type { WeekHistoryRow } from "@/lib/data/client-home";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDateShort } from "@/lib/utils/format";
import { Rings } from "./rings";
import { RING_COLORS } from "./ring-colors";

/** Week-by-week rings, oldest left, current week highlighted. */
export function RingsHistory({ rows, tone = "light", size = 84 }: { rows: WeekHistoryRow[]; tone?: "dark" | "light"; size?: number }) {
  const c = RING_COLORS[tone];
  const ordered = [...rows].reverse();
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {ordered.map((w, i) => {
        const closed = [w.rings.strength, w.rings.cardio, w.rings.food].filter((v) => v != null && v >= 1).length;
        const current = i === ordered.length - 1;
        return (
          <div key={w.start} style={{ animationDelay: `${i * 40}ms` }}
            className={cn("flex min-w-[104px] flex-1 animate-rise flex-col items-center gap-2 rounded-[18px] border px-2 py-3 transition-all hover:-translate-y-0.5",
              current ? (tone === "dark" ? "border-mint/40 bg-white/[0.04]" : "border-ink bg-surface") : tone === "dark" ? "border-band-line" : "border-line bg-surface hover:border-line-strong")}>
            <Rings size={size} delay={i * 0.05} track={tone === "dark" ? "rgba(255,255,255,0.08)" : "rgba(14,12,16,0.07)"}
              rings={[{ value: w.rings.strength, color: c.strength, label: t.rings.strength }, { value: w.rings.cardio, color: c.cardio, label: t.rings.cardio }, { value: w.rings.food, color: c.food, label: t.rings.food }]} />
            <span className="font-mono text-[11px] tabular text-muted">{formatDateShort(w.start)}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold", closed === 3 ? "bg-mint text-ink" : closed > 0 ? "bg-mint-soft text-mint-ink" : "text-faint")}>{closed}/3</span>
          </div>
        );
      })}
    </div>
  );
}
