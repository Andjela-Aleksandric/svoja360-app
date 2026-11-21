import type { DayTotals } from "@/lib/data/food-log";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDateShort, formatNumber } from "@/lib/utils/format";
import { Meter } from "@/components/ui/hero";

const L = t.foodLog;

/** Seven days of the client's food diary against plan targets (coach view). */
export function FoodWeek({ days, targets }: { days: DayTotals[]; targets: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } }) {
  const logged = days.filter((d) => d.entries > 0);
  if (!logged.length) return <p className="text-sm text-muted">{L.noLogs}</p>;
  const avg = (k: "kcal" | "protein" | "carbs" | "fat") => Math.round(logged.reduce((a, d) => a + d[k], 0) / logged.length);
  const cols: { k: "kcal" | "protein" | "carbs" | "fat"; label: string; target: number | null }[] = [
    { k: "kcal", label: "kcal", target: targets.kcal }, { k: "protein", label: "P", target: targets.protein }, { k: "carbs", label: "UH", target: targets.carbs }, { k: "fat", label: "M", target: targets.fat },
  ];
  const tone = (v: number, target: number | null) => (!target ? "" : Math.abs(v / target - 1) <= 0.1 ? "text-mint-ink" : "text-accent");
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-line text-left">
          <th className="eyebrow px-3 pb-2 text-[10px] font-normal">{L.day}</th>
          {cols.map((c) => <th key={c.k} className="eyebrow px-3 pb-2 text-[10px] font-normal">{c.label}{c.target ? ` · ${c.target}` : ""}</th>)}
          <th className="eyebrow px-3 pb-2 text-[10px] font-normal">{L.water}</th>
        </tr></thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date} className="transition-colors hover:bg-hover">
              <td className="px-3 py-2.5 font-semibold tabular">{formatDateShort(d.date)}</td>
              {cols.map((c) => (
                <td key={c.k} className="px-3 py-2.5">
                  {d.entries ? <><b className={cn("tabular", tone(d[c.k], c.target))}>{d[c.k]}</b>{c.k === "kcal" && c.target ? <Meter value={d.kcal} max={c.target} tone="ink" className="mt-1" /> : null}</> : <span className="text-faint">–</span>}
                </td>
              ))}
              <td className="px-3 py-2.5 tabular">{d.water ? `${formatNumber(d.water / 1000, 2)} l` : <span className="text-faint">–</span>}</td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <td className="px-3 py-2.5 font-bold">{L.avg}</td>
            {cols.map((c) => <td key={c.k} className={cn("px-3 py-2.5 font-bold tabular", tone(avg(c.k), c.target))}>{avg(c.k)}</td>)}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
