import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, Check, Dumbbell, Footprints, Trophy } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getClientTasks, getClientWeek, type WeekItem } from "@/lib/data/client-home";
import { getMeasurements } from "@/lib/data/clients";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { firstName, formatDate, formatNumber, formatWeekdayDate, greeting, todayISO, addDays } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { HeroBand, HeroStat } from "@/components/ui/hero";
import { ProgressRing } from "@/components/ui/progress";
import { CheckinBadge } from "@/components/clients/status";
import { TrendChart } from "@/components/charts/trend-chart";
import { WeekLegend, WeekStrip } from "@/components/plan/week-strip";
import { TodayPanel } from "@/components/plan/today-panel";
import { WeekRings } from "@/components/plan/week-rings";

export const metadata = { title: t.nav.client.home };

const H = t.clientHome;
const stepLabel = { initial: H.startInitial, initialContinue: H.continueInitial, diary: H.startDiary, checkin: H.doCheckin, checkinContinue: H.continueCheckin } as const;

export default async function ClientHome() {
  const viewer = await requireClient();
  const [{ steps, checkin }, measurements, week] = await Promise.all([
    getClientTasks(viewer.client.id, viewer.client.start_date), getMeasurements(viewer.client.id), getClientWeek(viewer.client.id, { historyWeeks: 1 }),
  ]);
  const today = todayISO();
  const weights = [...measurements].reverse().filter((m) => m.weight_kg != null).slice(-12).map((m) => ({ date: m.measured_on, value: m.weight_kg }));
  const sixWeeksAgo = addDays(today, -42);
  const recent = weights.filter((w) => w.date >= sixWeeksAgo);
  const delta = recent.length > 1 ? Math.round((Number(recent[recent.length - 1].value) - Number(recent[0].value)) * 10) / 10 : null;
  const s = week.strength, r = week.running;
  const left = s ? Math.max(0, s.planned - s.done) : 0;
  const hasPlan = !!(s || r || week.nutrition);
  const checkinText = checkin.status === "notDue" ? H.checkinNotDue : checkin.status === "submitted" || checkin.status === "reviewed" ? t.checkins.submitted : checkin.overdue ? t.checkins.overdue : t.checkins.due(`${formatWeekdayDate(checkin.deadline.date)} ${checkin.deadline.hour}:00`);

  return (
    <>
      <HeroBand
        eyebrow={`${H.heroEyebrow} · ${formatWeekdayDate(new Date())}`}
        title={`${greeting()}, ${firstName(viewer.client.full_name)}`}
        line={hasPlan ? (s ? H.heroLine(left) : undefined) : H.noPlanYet}
      >
        {hasPlan && (
          <div className="stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {week.history[0] && (
              <div className="col-span-2 rounded-[20px] border border-band-line bg-white/[0.03] p-4 transition-colors duration-300 hover:border-mint/40 sm:p-5">
                <div className="mb-3 flex items-baseline justify-between gap-3"><span className="eyebrow text-[10px] text-band-muted">{t.rings.title}</span>{s && <span className="font-mono text-[10.5px] text-band-muted">{H.weekOf(s.weekNo, s.weeks)}</span>}</div>
                <WeekRings week={week.history[0]} />
              </div>
            )}
            <HeroStat label={H.checkinStatus} value={checkin.status === "submitted" || checkin.status === "reviewed" ? "✓" : checkin.status === "notDue" ? "–" : "!"} accent={checkin.status === "missing" || checkin.status === "draft" ? "rasp" : "mint"} hint={checkinText} href="/klijent/izvestaji" />
            {week.nutrition && (
              <HeroStat label={H.todayNutrition} value={week.nutrition.kcal ? formatNumber(week.nutrition.kcal, 0) : "–"} hint={week.nutrition.kcal ? `kcal · ${t.nutrition.protein} ${week.nutrition.protein ?? "–"} g` : week.nutrition.name} href="/klijent/ishrana" />
            )}
          </div>
        )}
      </HeroBand>

      {(s || r || week.nutrition) && <TodayPanel week={week} />}

      {steps.length > 0 && (
        <section aria-label={H.nextAction} className="stagger mb-6 grid gap-3 md:grid-cols-2">
          {steps.map((st, i) => (
            <Link key={st.key} href={st.href}
              className={cn("group lift blob ripple-host flex items-center gap-4 rounded-[22px] border-[1.5px] p-5", i === 0 ? "border-accent bg-accent-soft/60 hover:border-ink" : "border-line bg-surface hover:border-ink")}>
              <div className="min-w-0 flex-1">
                <div className="eyebrow eyebrow-line text-[10px] text-accent">{H.nextAction}</div>
                <div className="mt-1.5 font-display text-[24px] leading-tight">{stepLabel[st.key]}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {st.deadline ? (st.overdue ? t.checkins.overdue : t.checkins.due(`${formatWeekdayDate(st.deadline.date)} ${st.deadline.hour}:00`)) : H.stepHelp[st.key]}
                </div>
              </div>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white transition-all duration-300 group-hover:translate-x-1 group-hover:bg-accent group-hover:shadow-[var(--shadow-glow)]"><ArrowRight className="size-5" /></span>
            </Link>
          ))}
        </section>
      )}

      {(s || r) && (
        <Card className="mb-4">
          <CardHeader title={H.weekPlan} description={`${H.weekPlanDesc} · ${formatDate(week.start)} – ${formatDate(addDays(week.start, 6))}`}
            action={<WeekLegend />} />
          <CardBody className="pt-4">
            <WeekStrip week={week} />
          </CardBody>
        </Card>
      )}

      <div className="stagger grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t.progress.weight}
            description={delta != null ? H.weightChange(`${delta > 0 ? "+" : ""}${formatNumber(delta, 1)}`) : undefined}
            action={<SeeAll href="/klijent/napredak" />} />
          <CardBody>
            {weights.length > 1 ? (
              <>
                <div className="mb-2 flex items-baseline gap-2"><span className="font-display text-[44px] leading-none tabular">{formatNumber(Number(weights[weights.length - 1].value), 1)}</span><span className="text-muted">kg</span></div>
                <TrendChart data={weights} unit="kg" ariaLabel={t.progress.weight} height={190} />
              </>
            ) : <p className="text-sm text-muted">{t.progress.noData}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={H.bestLifts} action={<SeeAll href="/klijent/napredak" />} />
          <CardBody>
            {week.prs.length === 0 ? <p className="text-sm text-muted">{H.noImprovements}</p> : (
              <ul className="stagger grid gap-1.5">
                {week.prs.map((p, i) => (
                  <li key={p.name} className="row-hover group flex items-center gap-3 rounded-[14px] px-3 py-2.5">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-10deg] group-hover:scale-110", i === 0 ? "bg-ink text-mint" : "bg-subtle text-muted")}><Trophy className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      {p.e1rm != null && <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">e1RM {formatNumber(p.e1rm, 1)} kg</span>}
                    </span>
                    {p.weight != null && <span className="font-display text-[22px] leading-none tabular">{formatNumber(p.weight, 1)}<span className="font-sans text-[12px] text-muted"> kg × {p.reps}</span></span>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {week.weeklyKm.some((w) => w.value > 0) && (
          <Card className="lg:col-span-2">
            <CardHeader title={H.weeklyKm} action={<SeeAll href="/klijent/trcanje" />} />
            <CardBody><TrendChart data={week.weeklyKm} kind="bar" unit="km" ariaLabel={H.weeklyKm} height={170} color="var(--color-ink)" /></CardBody>
          </Card>
        )}

        {week.nutrition && (
          <Card>
            <CardHeader title={H.targets} description={week.nutrition.name} action={<SeeAll href="/klijent/ishrana" />} />
            <CardBody className="grid grid-cols-2 gap-2">
              {[
                { l: "kcal", v: week.nutrition.kcal, u: "" },
                { l: t.nutrition.protein, v: week.nutrition.protein, u: "g" },
                { l: t.nutrition.carbs, v: week.nutrition.carbs, u: "g" },
                { l: t.nutrition.fat, v: week.nutrition.fat, u: "g" },
              ].map((m, i) => (
                <div key={m.l} className={cn("lift rounded-[16px] border border-line p-3.5 hover:border-ink", i === 0 && "band border-ink")}>
                  <div className={cn("eyebrow text-[9.5px]", i === 0 && "text-mint")}>{m.l}</div>
                  <div className="mt-1.5 font-display text-[28px] leading-none tabular">{m.v ?? "–"}<span className="text-[13px] opacity-60">{m.v != null && m.u ? ` ${m.u}` : ""}</span></div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title={H.checkinStatus} description={`${formatDate(checkin.period.start)} – ${formatDate(checkin.period.end)}`}
            action={checkin.status !== "notDue" ? <CheckinBadge status={checkin.status} /> : undefined} />
          <CardBody>
            <p className="flex items-center gap-2 text-sm text-muted"><CalendarClock className="size-4" />{checkinText}</p>
            <Link href="/klijent/izvestaji" className="group/l mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">{t.checkins.history}<ArrowUpRight className="size-4 transition-transform group-hover/l:-translate-y-0.5 group-hover/l:translate-x-0.5" /></Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function SeeAll({ href }: { href: string }) {
  return <Link href={href} className="group/l inline-flex items-center gap-1 text-sm font-semibold text-accent">{H.seeAll}<ArrowUpRight className="size-4 transition-transform group-hover/l:-translate-y-0.5 group-hover/l:translate-x-0.5" /></Link>;
}
