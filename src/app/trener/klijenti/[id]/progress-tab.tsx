import { getMeasurements } from "@/lib/data/clients";
import { getCheckinSeries } from "@/lib/data/checkins";
import { getStrengthAnalytics } from "@/lib/data/strength";
import { listActivities } from "@/lib/data/running";
import { getClientWeek, type WeekHistoryRow } from "@/lib/data/client-home";
import { getFoodTotals } from "@/lib/data/food-log";
import { createClient } from "@/lib/supabase/server";
import { computeRunningAnalytics } from "@/lib/running/analytics";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { addDays, formatDateShort, formatNumber, todayISO } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TrendChart } from "@/components/charts/trend-chart";
import { CheckinTrends } from "@/components/checkins/checkin-trends";
import { WeekRings } from "@/components/plan/week-rings";
import { RingsHistory } from "@/components/plan/rings-history";
import { RING_COLORS } from "@/components/plan/ring-colors";

const P = t.coachProgress;
const signed = (n: number, d = 1) => `${n > 0 ? "+" : ""}${formatNumber(n, d)}`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Average ring fill (each ring capped at 100%) over a set of weeks. */
function score(rows: WeekHistoryRow[]) {
  return mean(rows.flatMap((w) => [w.rings.strength, w.rings.cardio, w.rings.food].filter((v): v is number => v != null).map((v) => Math.min(1, v))));
}

/** Coach view of one client's progress: consistency first, then the numbers behind it. */
export async function ProgressTab({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const today = todayISO();
  const { data: client } = await supabase.from("clients").select("start_date").eq("id", clientId).maybeSingle();
  const [week, measurements, { analytics }, activities, series, food] = await Promise.all([
    getClientWeek(clientId, { snapshot: false, historyWeeks: 12, startDate: (client?.start_date as string) ?? undefined }),
    getMeasurements(clientId), getStrengthAnalytics(clientId), listActivities(clientId), getCheckinSeries(clientId, 12),
    getFoodTotals(clientId, addDays(today, -27), today),
  ]);
  const run = computeRunningAnalytics(activities);
  const h = week.history; // newest first
  const now4 = score(h.slice(1, 5)), prev4 = score(h.slice(5, 9));
  const cur = h[0];

  const weights = [...measurements].reverse().filter((m) => m.weight_kg != null).map((m) => ({ date: m.measured_on, value: Number(m.weight_kg) }));
  const lastW = weights.at(-1);
  const w4 = lastW ? [...weights].reverse().find((w) => w.date <= addDays(lastW.date, -28)) : undefined;
  const waist = [...measurements].reverse().filter((m) => m.waist_cm != null).map((m) => ({ date: m.measured_on, value: m.waist_cm }));
  const km4 = mean(run.weeklyKm.slice(-5, -1).map((x) => x.value)), kmPrev = mean(run.weeklyKm.slice(-9, -5).map((x) => x.value));
  const vol4 = mean(analytics.weeklyVolume.slice(-5, -1).map((x) => x.value)), volPrev = mean(analytics.weeklyVolume.slice(-9, -5).map((x) => x.value));
  const kcalTarget = week.nutrition?.kcal ?? null;
  const logged = food.filter((d) => d.entries > 0);
  const kcalAvg = mean(logged.map((d) => d.kcal));
  const proteinAvg = mean(logged.map((d) => d.protein));

  // Top lifts: most trained exercises with an e1RM trend.
  const top = analytics.prs.filter((p) => (analytics.e1rm[p.exercise_id]?.length ?? 0) > 1).sort((a, b) => b.sessions - a.sessions).slice(0, 3);
  const { data: exRows } = top.length ? await supabase.from("exercises").select("id, name").in("id", top.map((p) => p.exercise_id)) : { data: [] };
  const exName = new Map((exRows ?? []).map((e) => [e.id as string, e.name as string]));

  const kpis = [
    { label: P.score4w, value: now4 != null ? `${Math.round(now4 * 100)}%` : "–", delta: now4 != null && prev4 != null ? `${signed(Math.round((now4 - prev4) * 100), 0)} p.p.` : null, good: now4 != null && prev4 != null ? now4 >= prev4 : null },
    { label: P.weight4w, value: lastW ? `${formatNumber(lastW.value, 1)} kg` : "–", delta: lastW && w4 ? `${signed(lastW.value - w4.value)} kg` : null, good: null },
    { label: P.kmWeek, value: km4 != null ? `${formatNumber(km4, 1)} km` : "–", delta: km4 != null && kmPrev ? `${signed(((km4 - kmPrev) / kmPrev) * 100, 0)}%` : null, good: km4 != null && kmPrev ? km4 >= kmPrev : null },
    { label: P.volumeWeek, value: vol4 != null ? `${formatNumber(vol4 / 1000, 1)} t` : "–", delta: vol4 != null && volPrev ? `${signed(((vol4 - volPrev) / volPrev) * 100, 0)}%` : null, good: vol4 != null && volPrev ? vol4 >= volPrev : null },
    { label: P.kcalAvg, value: kcalAvg != null ? `${Math.round(kcalAvg)}` : "–", delta: kcalAvg != null && kcalTarget ? `${signed(Math.round(kcalAvg - kcalTarget), 0)} ${P.vsTarget}` : logged.length ? P.daysLogged(logged.length) : null, good: kcalAvg != null && kcalTarget ? Math.abs(kcalAvg / kcalTarget - 1) <= 0.1 : null },
    { label: P.proteinAvg, value: proteinAvg != null ? `${Math.round(proteinAvg)} g` : "–", delta: proteinAvg != null && week.nutrition?.protein ? `${P.target} ${week.nutrition.protein} g` : null, good: proteinAvg != null && week.nutrition?.protein ? proteinAvg >= week.nutrition.protein * 0.9 : null },
  ];

  return (
    <div className="grid gap-4 [&>*]:min-w-0">
      {/* Consistency hero */}
      <section className="band relative isolate overflow-hidden rounded-[26px] p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-28 -z-10 size-96 rounded-full bg-[radial-gradient(closest-side,rgba(194,37,92,0.3),transparent)]" />
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="eyebrow eyebrow-line mb-4 text-band-muted">{P.thisWeek}</div>
            {cur && <WeekRings week={cur} size={190} />}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-[18px] border border-band-line bg-white/[0.03] p-3.5 transition-all hover:-translate-y-0.5 hover:border-mint/40">
                <div className="eyebrow text-[9.5px] text-band-muted">{k.label}</div>
                <div className="mt-1.5 font-display text-[30px] leading-none tabular">{k.value}</div>
                {k.delta && <div className={cn("mt-1.5 font-mono text-[11px]", k.good == null ? "text-band-muted" : k.good ? "text-mint" : "text-[#ff6b9a]")}>{k.delta}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <Card>
        <CardHeader title={P.heatmap} description={P.heatmapDesc} />
        <CardBody className="pt-3"><Heatmap rows={h} /></CardBody>
      </Card>

      <Card>
        <CardHeader title={t.rings.history} description={P.ringsDesc} />
        <CardBody className="pt-3"><RingsHistory rows={h} /></CardBody>
      </Card>

      <div className="stagger grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title={t.progress.weight} description={lastW && weights.length > 1 ? `${t.progress.changeSinceStart}: ${signed(lastW.value - weights[0].value)} kg` : undefined} />
          <CardBody>{weights.length > 1 ? <TrendChart data={weights} unit="kg" height={200} ariaLabel={t.progress.weight} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title={P.kcal28} description={kcalTarget ? `${P.target} ${kcalTarget} kcal` : undefined} />
          <CardBody>{logged.length ? <TrendChart data={food.map((d) => ({ date: d.date, value: d.entries ? d.kcal : null }))} kind="bar" unit="kcal" digits={0} height={200} ariaLabel={P.kcal28} color={RING_COLORS.light.food} /> : <p className="text-sm text-muted">{t.foodLog.noLogs}</p>}</CardBody>
        </Card>
        <Card><CardHeader title={t.strengthAnalytics.weeklyVolume} /><CardBody><TrendChart data={analytics.weeklyVolume} kind="bar" unit="kg" digits={0} height={200} ariaLabel={t.strengthAnalytics.weeklyVolume} color={RING_COLORS.light.strength} /></CardBody></Card>
        <Card><CardHeader title={t.running.weekly} /><CardBody><TrendChart data={run.weeklyKm} kind="bar" unit="km" height={200} ariaLabel={t.running.weekly} color={RING_COLORS.light.cardio} /></CardBody></Card>
        {waist.length > 1 && <Card><CardHeader title={t.measurements.waist_cm} /><CardBody><TrendChart data={waist} unit="cm" height={200} ariaLabel={t.measurements.waist_cm} /></CardBody></Card>}
      </div>

      {top.length > 0 && (
        <Card>
          <CardHeader title={P.topLifts} description={P.topLiftsDesc} />
          <CardBody className="grid gap-4 md:grid-cols-3">
            {top.map((p) => {
              const s = analytics.e1rm[p.exercise_id];
              const gain = s.at(-1)!.value - s[0].value;
              return (
                <div key={p.exercise_id} className="rounded-[18px] border border-line p-4">
                  <div className="truncate font-bold">{exName.get(p.exercise_id) ?? ""}</div>
                  <div className="mt-1 flex items-baseline gap-2"><span className="font-display text-[30px] leading-none tabular">{formatNumber(s.at(-1)!.value, 1)} kg</span><span className={cn("font-mono text-[12px]", gain >= 0 ? "text-mint-ink" : "text-accent")}>{signed(gain)} kg</span></div>
                  <div className="mt-2"><TrendChart data={s} unit="kg" height={120} ariaLabel={exName.get(p.exercise_id) ?? ""} color={RING_COLORS.light.strength} /></div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      <CheckinTrends series={series} />
    </div>
  );
}

function Heatmap({ rows }: { rows: WeekHistoryRow[] }) {
  const weeks = [...rows].reverse();
  const c = RING_COLORS.light;
  const lines: { label: string; color: string; get: (w: WeekHistoryRow) => number | null; text: (w: WeekHistoryRow) => string }[] = [
    { label: t.rings.strength, color: c.strength, get: (w) => w.rings.strength, text: (w) => (w.strengthPlanned ? `${w.strengthDone}/${w.strengthPlanned}` : "–") },
    { label: t.rings.cardio, color: c.cardio, get: (w) => w.rings.cardio, text: (w) => (w.targetMin ? `${w.minutes}′` : w.targetKm ? formatNumber(w.km, 0) : "–") },
    { label: t.rings.food, color: c.food, get: (w) => w.rings.food, text: (w) => (w.rings.food == null ? "–" : `${w.foodOnTarget}/7`) },
    { label: t.profile.overview.colCheckin, color: c.strength, get: (w) => (w.checkin === "sent" ? 1 : w.checkin === "missing" ? 0 : null), text: (w) => (w.checkin === "sent" ? "✓" : w.checkin === "missing" ? "✕" : "·") },
  ];
  const hex = (h: string, a: number) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 text-[12.5px]">
        <thead>
          <tr><th className="w-28" />{weeks.map((w, i) => <th key={w.start} className={cn("pb-1 text-center font-mono text-[10px] font-normal tabular", i === weeks.length - 1 ? "text-ink" : "text-muted")}>{formatDateShort(w.start)}</th>)}</tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <th className="pr-2 text-left text-[13px] font-semibold"><span className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: l.color }} />{l.label}</th>
              {weeks.map((w) => {
                const v = l.get(w);
                const a = v == null ? 0 : 0.12 + Math.min(1, v) * 0.78;
                const dark = v != null && Math.min(1, v) > 0.55;
                return (
                  <td key={w.start} title={v == null ? "–" : `${Math.round(Math.min(v, 1.25) * 100)}%`}
                    className={cn("h-11 rounded-[10px] text-center font-semibold tabular transition-transform hover:scale-105", v == null && "bg-subtle text-faint")}
                    style={v == null ? undefined : { background: hex(l.color, a), color: dark && l.color !== c.cardio ? "#fff" : "#0E0C10" }}>
                    {l.text(w)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
