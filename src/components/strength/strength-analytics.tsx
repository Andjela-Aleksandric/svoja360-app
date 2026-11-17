"use client";
import { useState } from "react";
import { Info, Trophy } from "lucide-react";
import type { StrengthAnalytics } from "@/lib/strength/analytics";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/input";
import { TrendChart } from "@/components/charts/trend-chart";

export function StrengthAnalyticsView({ data, names }: { data: StrengthAnalytics; names: Record<string, string> }) {
  const withE1 = data.prs.filter((p) => (data.e1rm[p.exercise_id]?.length ?? 0) > 0);
  const [ex, setEx] = useState(withE1[0]?.exercise_id ?? "");
  if (!data.sessions) return <p className="text-sm text-muted">{t.workout.noHistory}</p>;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t.strengthAnalytics.totalVolume} value={`${formatNumber(data.totalVolume / 1000, 1)} t`} />
        <StatCard label={t.workout.history} value={data.sessions} />
        <StatCard label={t.strengthAnalytics.prs} value={data.prs.length} className="col-span-2 sm:col-span-1" />
      </div>
      <Card>
        <CardHeader title={t.strengthAnalytics.weeklyVolume} description={t.strengthAnalytics.volumeExplain} />
        <CardBody><TrendChart data={data.weeklyVolume} kind="bar" unit="kg" digits={0} ariaLabel={t.strengthAnalytics.weeklyVolume} /></CardBody>
      </Card>
      {withE1.length > 0 && (
        <Card>
          <CardHeader title={t.strengthAnalytics.e1rm} description={t.strengthAnalytics.e1rmExplain}
            action={<NativeSelect aria-label={t.strengthAnalytics.chooseExercise} value={ex} onChange={(e) => setEx(e.target.value)} className="h-9 w-auto max-w-[200px] text-sm">{withE1.map((p) => <option key={p.exercise_id} value={p.exercise_id}>{names[p.exercise_id]}</option>)}</NativeSelect>} />
          <CardBody>{(data.e1rm[ex]?.length ?? 0) > 1 ? <TrendChart data={data.e1rm[ex]} unit="kg" ariaLabel={t.strengthAnalytics.e1rm} /> : <p className="flex items-center gap-2 text-sm text-muted"><Info className="size-4" />{t.progress.noData}</p>}</CardBody>
        </Card>
      )}
      <Card>
        <CardHeader title={t.strengthAnalytics.prs} />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 font-semibold">{t.exercises.name}</th><th className="py-2 text-right font-semibold">{t.strengthAnalytics.e1rm}</th><th className="py-2 text-right font-semibold">{t.strength.weight}</th><th className="py-2 text-right font-semibold">{t.strengthAnalytics.frequency}</th></tr></thead>
              <tbody>
                {data.prs.map((p) => (
                  <tr key={p.exercise_id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 font-semibold"><Trophy className="mr-1.5 inline size-3.5 text-accent" />{names[p.exercise_id] ?? "–"}</td>
                    <td className="py-2.5 text-right tabular">{p.e1rm != null ? <>{formatNumber(p.e1rm)} kg <span className="block text-[11px] text-muted">{formatDate(p.e1rmDate)}</span></> : "–"}</td>
                    <td className="py-2.5 text-right tabular">{p.maxWeight != null ? <>{formatNumber(p.maxWeight, 2)} kg × {p.maxWeightReps}<span className="block text-[11px] text-muted">{formatDate(p.maxWeightDate)}</span></> : "–"}</td>
                    <td className="py-2.5 text-right tabular">{p.sessions}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
