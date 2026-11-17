import type { Macros } from "@/lib/utils/nutrition";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

export function MacroLine({ m, className }: { m: Macros; className?: string }) {
  return (
    <span className={cn("tabular text-xs text-muted", className)}>
      <strong className="text-ink">{Math.round(m.kcal)}</strong> kcal · {t.nutrition.proteinShort} {formatNumber(m.protein, 0)} · {t.nutrition.carbsShort} {formatNumber(m.carbs, 0)} · {t.nutrition.fatShort} {formatNumber(m.fat, 0)}
    </span>
  );
}

/** Day totals against the targets. One bar per nutrient, labels in text (not colour only). */
export function TargetBars({ m, targets }: { m: Macros; targets: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null } }) {
  const rows = [
    { k: "kcal", label: t.nutrition.kcal, v: m.kcal, target: targets.kcal, unit: "kcal" },
    { k: "protein", label: t.nutrition.protein, v: m.protein, target: targets.protein, unit: "g" },
    { k: "carbs", label: t.nutrition.carbs, v: m.carbs, target: targets.carbs, unit: "g" },
    { k: "fat", label: t.nutrition.fat, v: m.fat, target: targets.fat, unit: "g" },
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((r) => {
        const pct = r.target ? Math.round((r.v / r.target) * 100) : null;
        const off = pct != null && (pct < 90 || pct > 110);
        return (
          <div key={r.k} className="rounded-[14px] border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between text-[13px]"><span className="font-semibold text-muted">{r.label}</span>{pct != null && <span className={cn("text-xs font-bold tabular", off ? "text-warning" : "text-success")}>{pct}%</span>}</div>
            <div className="mt-1 text-lg font-extrabold tabular">{formatNumber(r.v, 0)}<span className="text-sm font-semibold text-muted">{r.target ? ` / ${r.target}` : ""} {r.unit}</span></div>
            {r.target ? <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle"><div className={cn("h-full rounded-full", off ? "bg-warning" : "bg-ink")} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div> : null}
          </div>
        );
      })}
    </div>
  );
}
