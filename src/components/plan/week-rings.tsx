import type { WeekHistoryRow } from "@/lib/data/client-home";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { Rings } from "./rings";
import { RING_COLORS } from "./ring-colors";

const R = t.rings;

export function ringRows(w: WeekHistoryRow, tone: "dark" | "light") {
  const c = RING_COLORS[tone];
  const cardioByMin = w.targetMin != null;
  return [
    { key: "strength", label: R.strength, color: c.strength, value: w.rings.strength, text: w.strengthPlanned ? R.workouts(w.strengthDone, w.strengthPlanned) : R.noPlan },
    { key: "cardio", label: R.cardio, color: c.cardio, value: w.rings.cardio,
      text: cardioByMin ? `${w.minutes} / ${w.targetMin} min` : w.targetKm ? `${formatNumber(w.km, 1)} / ${formatNumber(w.targetKm, 0)} km` : w.km > 0 ? `${formatNumber(w.km, 1)} km` : R.noPlan },
    { key: "food", label: R.food, color: c.food, value: w.rings.food, text: w.rings.food == null ? R.noPlan : R.days(w.foodOnTarget) },
  ];
}

/** Big rings with a legend: what each ring means and how far along it is this week. */
export function WeekRings({ week, tone = "dark", size = 176, className }: { week: WeekHistoryRow; tone?: "dark" | "light"; size?: number; className?: string }) {
  const rows = ringRows(week, tone);
  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:gap-7", className)}>
      <Rings size={size} rings={rows.map((r) => ({ value: r.value, color: r.color, label: r.label }))} track={tone === "dark" ? "rgba(255,255,255,0.08)" : "rgba(14,12,16,0.07)"} />
      <ul className="grid w-full gap-3">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="size-3 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="min-w-0 flex-1">
              <span className={cn("eyebrow block text-[10px]", tone === "dark" && "text-band-muted")}>{r.label}</span>
              <span className="block truncate text-[15px] font-semibold tabular">{r.text}</span>
            </span>
            <span className="font-display text-[26px] leading-none tabular" style={{ color: r.value != null && r.value >= 1 ? r.color : undefined }}>
              {r.value == null ? "–" : `${Math.round(Math.min(r.value, 1.25) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
