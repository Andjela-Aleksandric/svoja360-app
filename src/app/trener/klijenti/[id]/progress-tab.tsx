import { getMeasurements } from "@/lib/data/clients";
import { getCheckinSeries } from "@/lib/data/checkins";
import { getStrengthAnalytics } from "@/lib/data/strength";
import { listActivities } from "@/lib/data/running";
import { computeRunningAnalytics } from "@/lib/running/analytics";
import { t } from "@/lib/i18n/sr";
import { formatNumber } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { TrendChart } from "@/components/charts/trend-chart";
import { CheckinTrends } from "@/components/checkins/checkin-trends";

/** One page with every number: body, strength, running and check-in trends. */
export async function ProgressTab({ clientId }: { clientId: string }) {
  const [measurements, { analytics }, activities, series] = await Promise.all([getMeasurements(clientId), getStrengthAnalytics(clientId), listActivities(clientId), getCheckinSeries(clientId, 12)]);
  const weights = [...measurements].reverse().filter((m) => m.weight_kg != null).map((m) => ({ date: m.measured_on, value: m.weight_kg }));
  const waist = [...measurements].reverse().filter((m) => m.waist_cm != null).map((m) => ({ date: m.measured_on, value: m.waist_cm }));
  const run = computeRunningAnalytics(activities);
  const adherence = series.filter((p) => p.values.strength_planned).map((p) => ({ date: p.periodEnd, value: Math.round(((p.values.strength_done ?? 0) / (p.values.strength_planned || 1)) * 100) }));
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.progress.weight} value={weights.length ? `${formatNumber(weights.at(-1)!.value)} kg` : "–"} hint={weights.length > 1 ? `${t.progress.changeSinceStart}: ${formatNumber((weights.at(-1)!.value as number) - (weights[0].value as number))} kg` : undefined} />
        <StatCard label={t.strengthAnalytics.totalVolume} value={`${formatNumber(analytics.totalVolume / 1000, 1)} t`} hint={`${analytics.sessions} ${t.workout.history.toLowerCase()}`} />
        <StatCard label={t.running.totalDistance} value={`${formatNumber(run.totalKm, 1)} km`} />
        <StatCard label={t.progress.trainingAdherence} value={adherence.length ? `${adherence.at(-1)!.value}%` : "–"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={t.progress.weight} /><CardBody>{weights.length > 1 ? <TrendChart data={weights} unit="kg" height={180} ariaLabel={t.progress.weight} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}</CardBody></Card>
        <Card><CardHeader title={t.measurements.waist_cm} /><CardBody>{waist.length > 1 ? <TrendChart data={waist} unit="cm" height={180} ariaLabel={t.measurements.waist_cm} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}</CardBody></Card>
        <Card><CardHeader title={t.strengthAnalytics.weeklyVolume} /><CardBody><TrendChart data={analytics.weeklyVolume} kind="bar" unit="kg" digits={0} height={180} ariaLabel={t.strengthAnalytics.weeklyVolume} /></CardBody></Card>
        <Card><CardHeader title={t.running.weekly} /><CardBody><TrendChart data={run.weeklyKm} kind="bar" unit="km" height={180} ariaLabel={t.running.weekly} /></CardBody></Card>
        {adherence.length > 1 && <Card><CardHeader title={t.progress.trainingAdherence} /><CardBody><TrendChart data={adherence} kind="bar" unit="%" digits={0} height={180} ariaLabel={t.progress.trainingAdherence} /></CardBody></Card>}
      </div>
      <CheckinTrends series={series} />
    </div>
  );
}
