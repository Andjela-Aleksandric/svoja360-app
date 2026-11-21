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

export const metadata = { title: t.nav.client.home };

const H = t.clientHome;
const stepLabel = { initial: H.startInitial, initialContinue: H.continueInitial, diary: H.startDiary, checkin: H.doCheckin, checkinContinue: H.continueCheckin } as const;

export default async function ClientHome() {
  const viewer = await requireClient();
  const [{ steps, checkin }, measurements, week] = await Promise.all([
    getClientTasks(viewer.client.id, viewer.client.start_date), getMeasurements(viewer.client.id), getClientWeek(viewer.client.id),
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
            {s && (
              <div className="group/hs col-span-2 flex items-center gap-4 rounded-[20px] border border-band-line bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-1 hover:border-mint/50 sm:p-5 lg:col-span-1">
                <ProgressRing value={s.done} max={s.planned || 1} size={78} stroke={7} tone="mint" track="var(--color-band-line)">
                  <span className="font-display text-[26px] leading-none">{s.done}<span className="text-band-muted">/{s.planned}</span></span>
                </ProgressRing>
                <div className="min-w-0">
                  <div className="eyebrow text-[10px] text-band-muted">{H.heroStrength}</div>
                  <div className="mt-1 truncate text-[15px] font-semibold">{s.name}</div>
                  <div className="font-mono text-[11px] text-band-muted">{H.weekOf(s.weekNo, s.weeks)}</div>
                </div>
              </div>
            )}
            {r && (
              <HeroStat label={r.targetMin != null ? H.heroRunMin : H.heroRun} value={r.targetMin != null ? r.min : formatNumber(r.km, 1)} accent="mint"
                hint={r.targetMin != null ? H.heroOf(`${r.targetMin} min`) : r.target ? H.heroOf(`${formatNumber(r.target, 0)} km`) : t.dashboard.heroRuns(r.done)}>
                {(r.targetMin || r.target) ? <span className="mt-3 block h-1 overflow-hidden rounded-full bg-band-line"><span className="block h-full origin-left animate-[meter_1s_cubic-bezier(.2,.7,.2,1)_both] rounded-full bg-mint" style={{ width: `${Math.min(100, r.targetMin ? (r.min / r.targetMin) * 100 : (r.km / r.target!) * 100)}%` }} /></span> : null}
              </HeroStat>
            )}
            <HeroStat label={H.checkinStatus} value={checkin.status === "submitted" || checkin.status === "reviewed" ? "✓" : checkin.status === "notDue" ? "–" : "!"} accent={checkin.status === "missing" || checkin.status === "draft" ? "rasp" : "mint"} hint={checkinText} href="/klijent/izvestaji" />
            {week.nutrition && (
              <HeroStat label={H.todayNutrition} value={week.nutrition.kcal ? formatNumber(week.nutrition.kcal, 0) : "–"} hint={week.nutrition.kcal ? `kcal · ${t.nutrition.protein} ${week.nutrition.protein ?? "–"} g` : week.nutrition.name} href="/klijent/ishrana" />
            )}
          </div>
        )}
      </HeroBand>

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
            action={<div className="hidden gap-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted sm:flex"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" />{t.nav.client.workouts}</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ink" />{t.nav.client.running}</span></div>} />
          <CardBody className="pt-4">
            <div className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
              {week.days.map((d, i) => {
                const isToday = d.date === today, past = d.date < today;
                const empty = d.items.length === 0;
                return (
                  <div key={d.date} style={{ animationDelay: `${i * 50}ms` }}
                    className={cn("group/day flex min-h-[188px] w-[150px] shrink-0 snap-start animate-rise flex-col rounded-[20px] border-[1.5px] p-3 transition-all duration-300 lg:w-auto",
                      isToday ? "band border-ink shadow-[0_20px_40px_-24px_rgba(14,12,16,0.9)]" : "border-line bg-surface hover:-translate-y-1 hover:border-line-strong",
                      past && !isToday && "opacity-80")}>
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className={cn("eyebrow text-[10px]", isToday && "text-mint")}>{isToday ? H.today : t.weekdaysShort[i]}</span>
                      <span className={cn("font-display text-[26px] leading-none", isToday ? "text-band-fg" : "text-ink")}>{Number(d.date.slice(8))}</span>
                    </div>
                    <div className="grid flex-1 content-start gap-1.5">
                      {d.items.map((it) => <PlanChip key={it.id} it={it} dark={isToday} />)}
                      {empty && <span className={cn("mt-auto text-[12.5px]", isToday ? "text-band-muted" : "text-faint")}>{H.rest}</span>}
                    </div>
                    {(d.loggedStrength > 0 || d.loggedKm > 0) && (
                      <div className={cn("mt-2 flex flex-wrap gap-1 border-t pt-2 font-mono text-[10px] uppercase tracking-[0.06em]", isToday ? "border-band-line text-mint" : "border-line text-mint-ink")}>
                        <Check className="size-3" />{H.done}{d.loggedKm > 0 ? ` · ${formatNumber(d.loggedKm, 1)} km` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {week.flexible.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow mb-2 text-[10px]">{H.flexible}</div>
                <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{week.flexible.map((it) => <PlanRow key={it.id} it={it} />)}</div>
              </div>
            )}
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

function PlanChip({ it, dark }: { it: WeekItem; dark?: boolean }) {
  const Icon = it.kind === "strength" ? Dumbbell : Footprints;
  return (
    <Link href={it.href} title={it.title}
      className={cn("group/chip flex items-start gap-2 rounded-[12px] px-2 py-1.5 text-left transition-all duration-200 hover:translate-x-0.5",
        dark ? "bg-white/[0.06] hover:bg-white/[0.12]" : it.kind === "strength" ? "bg-accent-soft/70 hover:bg-accent-soft" : "bg-subtle hover:bg-hover")}>
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", it.done ? "bg-mint text-ink" : it.kind === "strength" ? "bg-accent text-white" : dark ? "bg-band-fg text-band" : "bg-ink text-white")}>
        {it.done ? <Check className="size-3" strokeWidth={3} /> : <Icon className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className={cn("line-clamp-2 text-[12.5px] font-semibold leading-tight", it.done && "line-through decoration-mint decoration-2")}>{it.title}</span>
        <span className={cn("block font-mono text-[10px]", dark ? "text-band-muted" : "text-muted")}>{it.sub}</span>
      </span>
    </Link>
  );
}

function PlanRow({ it }: { it: WeekItem }) {
  const Icon = it.kind === "strength" ? Dumbbell : Footprints;
  return (
    <Link href={it.href} className="group lift blob flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:border-ink">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110", it.done ? "bg-mint text-ink" : it.kind === "strength" ? "bg-accent-soft text-accent" : "bg-subtle text-ink")}>
        {it.done ? <Check className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{it.title}</span><span className="text-xs text-muted">{it.done ? H.done : it.sub}</span></span>
      <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
