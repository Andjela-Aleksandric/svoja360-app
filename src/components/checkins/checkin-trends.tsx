import type { CheckinPoint } from "@/lib/data/checkins";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TrendChart } from "@/components/charts/trend-chart";

const METRICS: { code: keyof CheckinPoint["values"]; unit?: string; kind?: "bar" }[] = [
  { code: "avg_weight", unit: "kg" },
  { code: "nutrition_adherence" },
  { code: "sleep_quality" },
  { code: "recovery_energy" },
  { code: "stress" },
  { code: "mood_motivation" },
  { code: "sleep_hours", unit: "h" },
  { code: "strength_done", kind: "bar" },
];

/** Small multiples: one single-series chart per metric (never a shared dual axis). */
export function CheckinTrends({ series, compact }: { series: CheckinPoint[]; compact?: boolean }) {
  return (
    <Card>
      <CardHeader title={t.checkins.trends} />
      <CardBody>
        {series.length < 2 ? <p className="text-sm text-muted">{t.checkins.needTwo}</p> : (
          <div className={cn("grid gap-5", !compact && "sm:grid-cols-2")}>
            {METRICS.map((m) => {
              const data = series.map((p) => ({ date: p.periodEnd, value: p.values[m.code] ?? null }));
              if (data.filter((d) => d.value != null).length < 2) return null;
              return (
                <div key={m.code}>
                  <div className="mb-1 text-[13px] font-semibold text-ink-2">{t.checkins.trendLabels[m.code]}</div>
                  <TrendChart data={data} unit={m.unit} height={compact ? 120 : 150} kind={m.kind} ariaLabel={t.checkins.trendLabels[m.code]} />
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
