import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, ClipboardCheck, Dumbbell, Footprints, Apple, UserPlus, Activity, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { getCoachDashboard, type WeekRow } from "@/lib/data/dashboard";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { firstName, formatDate, formatDateTime, formatNumber, greeting, relativeDays } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HeroBand, HeroStat, Meter } from "@/components/ui/hero";
import { WhatsAppButton } from "@/components/clients/wa-button";

export const metadata = { title: t.nav.coach.dashboard };

const reasonTone = { pain: "danger", highStress: "warning", missingCheckin: "danger", lowAdherence: "warning", initialPending: "info", noProgram: "neutral" } as const;
const D = t.dashboard;

export default async function CoachDashboard() {
  const viewer = await requireCoach();
  const { stats, attention, activity, period, weekBoard, week, todayPlan } = await getCoachDashboard();
  const urgent = attention.filter((a) => a.reasons.some((r) => r !== "noProgram" && r !== "initialPending")).length;
  const quick = [
    { href: "/trener/klijenti/novi", label: D.addClient, icon: UserPlus },
    { href: "/trener/izvestaji", label: D.reviewCheckins, icon: ClipboardCheck },
    { href: "/trener/trening/novi", label: D.createProgram, icon: Dumbbell },
    { href: "/trener/trcanje/novi", label: D.createRun, icon: Footprints },
    { href: "/trener/ishrana/novi", label: D.createNutrition, icon: Apple },
  ];

  return (
    <>
      <HeroBand
        eyebrow={D.heroEyebrow(formatDate(week.start))}
        title={`${greeting()}, ${firstName(viewer.fullName ?? "")}`.replace(/, $/, "")}
        line={D.heroLine(stats.pending, urgent)}
        action={stats.pending > 0 ? (
          <Link href="/trener/izvestaji" className="group/b ripple-host inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-white transition-all hover:bg-mint hover:text-ink hover:shadow-[0_12px_30px_-10px_rgba(142,214,184,0.8)]">
            {D.openReports}<ArrowUpRight className="size-4 transition-transform group-hover/b:-translate-y-0.5 group-hover/b:translate-x-0.5" />
          </Link>
        ) : undefined}
      >
        <div className="stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <HeroStat label={D.heroToReview} value={stats.pending} href="/trener/izvestaji" accent={stats.pending ? "rasp" : undefined} hint={`${stats.reviewedThisWeek} ${D.reviewedCheckins.toLowerCase()}`} />
          <HeroStat label={D.heroAttention} value={urgent} accent={urgent ? "rasp" : undefined} hint={`${attention.length} ${t.common.total.toLowerCase()}`} />
          <HeroStat label={D.heroWorkouts} value={week.workoutsDone} accent="mint" hint={week.compliance != null ? D.heroCompliance(week.compliance) : D.heroNoPlan}>
            {week.compliance != null && <span className="mt-3 block h-1 overflow-hidden rounded-full bg-band-line"><span className="block h-full origin-left animate-[meter_1s_cubic-bezier(.2,.7,.2,1)_both] rounded-full bg-mint" style={{ width: `${week.compliance}%` }} /></span>}
          </HeroStat>
          <HeroStat label={D.heroKm} value={formatNumber(week.km, 1)} hint={D.heroRuns(week.runs)} />
        </div>
      </HeroBand>

      {todayPlan.length > 0 && (
        <Card className="mb-4">
          <CardHeader title={D.todayTitle} description={D.todayDesc(todayPlan.reduce((a, r) => a + r.items.filter((i) => i.done).length, 0), todayPlan.reduce((a, r) => a + r.items.length, 0))} />
          <CardBody className="stagger grid gap-2 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {todayPlan.map((r) => (
              <Link key={r.client.id} href={`/trener/klijenti/${r.client.id}`} className="group lift flex items-center gap-3 rounded-[16px] border border-line p-3 hover:border-ink">
                <Avatar name={r.client.full_name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold transition-colors group-hover:text-accent">{r.client.full_name}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {r.items.map((it, k) => (
                      <span key={k} className={cn("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold", it.done ? "bg-mint-soft text-mint-ink" : it.kind === "strength" ? "bg-accent-soft text-accent" : "bg-subtle text-ink-2")}>
                        {it.done ? <Check className="size-3" strokeWidth={3} /> : it.kind === "strength" ? <Dumbbell className="size-3" /> : <Footprints className="size-3" />}
                        <span className="truncate">{it.title}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader title={D.weekBoard} description={D.weekBoardDesc}
          action={<Link href="/trener/klijenti" className="group/l inline-flex items-center gap-1 text-sm font-semibold text-accent">{D.allClients}<ArrowUpRight className="size-4 transition-transform group-hover/l:-translate-y-0.5 group-hover/l:translate-x-0.5" /></Link>} />
        <CardBody className="pt-3">
          {weekBoard.length === 0 ? (
            <EmptyState icon={<UserPlus />} title={D.weekBoardEmpty} className="border-0 py-6" />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr_0.9fr] gap-4 border-b border-line px-3 pb-2.5 md:grid">
                {[D.colClient, D.colStrength, D.colRunning, D.colCheckin, D.colWeight].map((h) => <span key={h} className="eyebrow text-[10px]">{h}</span>)}
              </div>
              <ul className="stagger -mx-2 grid md:mx-0">
                {weekBoard.map((r) => <BoardRow key={r.client.id} r={r} />)}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={D.needsAttention} description={`${formatDate(period.start)} – ${formatDate(period.end)}`} />
          <CardBody>
            {attention.length === 0 ? (
              <EmptyState icon={<Sparkles />} title={D.needsAttentionEmpty} className="border-0 py-8" />
            ) : (
              <ul className="stagger -mx-2 grid">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.client.id} className="row-hover group flex items-center gap-3 rounded-[16px] px-3 py-2.5">
                    <Link href={`/trener/klijenti/${a.client.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={a.client.full_name} size={40} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold transition-colors group-hover:text-accent">{a.client.full_name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.reasons.map((r) => (
                            <Badge key={r} tone={reasonTone[r]}>{(r === "pain" || r === "missingCheckin") && <AlertTriangle className="size-3" />}{D.reasons[r]}</Badge>
                          ))}
                        </div>
                      </div>
                    </Link>
                    <WhatsAppButton phone={a.client.phone_e164} compact />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title={D.quickActions} />
            <CardBody className="stagger grid gap-1.5">
              {quick.map((q) => (
                <Link key={q.href} href={q.href} className="group ripple-host flex h-12 items-center gap-3 rounded-[14px] border-[1.5px] border-line px-3.5 text-sm font-semibold transition-all duration-200 hover:border-ink hover:bg-ink hover:pl-4 hover:text-white">
                  <q.icon className="size-[18px] text-muted transition-colors group-hover:text-mint" />
                  <span className="flex-1">{q.label}</span>
                  <ArrowUpRight className="size-4 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mint" />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={D.recentActivity} />
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState icon={<Activity />} title={D.recentActivityEmpty} className="border-0 py-6" />
              ) : (
                <ol className="stagger relative grid gap-3.5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
                  {activity.map((a) => (
                    <li key={a.id} className="group relative pl-6">
                      <span className={cn("absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface transition-transform group-hover:scale-150", a.kind === "workout" || a.kind === "run" ? "bg-mint-ink" : "bg-accent")} aria-hidden />
                      <Link href={a.href} className="block text-sm transition-colors hover:text-accent">
                        <span className="font-semibold">{a.clientName}</span> <span className="text-muted">· {D.activity[a.kind]}{a.detail ? `: ${a.detail}` : ""}</span>
                      </Link>
                      <div className="font-mono text-[11px] text-faint">{formatDateTime(a.at)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function BoardRow({ r }: { r: WeekRow }) {
  const s = r.strength, run = r.running, w = r.weight;
  const TrendIcon = !w || w.delta == null || w.delta === 0 ? Minus : w.delta > 0 ? TrendingUp : TrendingDown;
  return (
    <li>
      <Link href={`/trener/klijenti/${r.client.id}`}
        className="row-hover group grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[16px] px-3 py-3.5 md:grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr_0.9fr] md:rounded-[12px]">
        <span className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
          <Avatar name={r.client.full_name} size={36} />
          <span className="truncate font-semibold transition-colors group-hover:text-accent">{r.client.full_name}</span>
          {r.flagged && <span className="live-dot shrink-0 text-accent" title={D.needsAttention} />}
        </span>
        <Cell label={D.colStrength} icon={<Dumbbell className="size-3.5" />}>
          {s && s.planned > 0 ? (
            <><span className="tabular"><b className={cn(s.done >= s.planned && "text-mint-ink")}>{s.done}</b><span className="text-muted">/{s.planned}</span></span><Meter value={s.done} max={s.planned} className="mt-1.5" /></>
          ) : <span className="text-faint">–</span>}
        </Cell>
        <Cell label={D.colRunning} icon={<Footprints className="size-3.5" />}>
          {run ? (
            run.targetMin != null
              ? <><span className="tabular"><b>{run.min}</b><span className="text-muted"> / {run.targetMin} min</span></span>{run.targetMin ? <Meter value={run.min} max={run.targetMin} tone="ink" className="mt-1.5" /> : null}</>
              : <><span className="tabular"><b>{formatNumber(run.km, 1)}</b><span className="text-muted">{run.target ? ` / ${formatNumber(run.target, 0)} km` : " km"}</span></span>{run.target ? <Meter value={run.km} max={run.target} tone="ink" className="mt-1.5" /> : null}</>
          ) : <span className="text-faint">–</span>}
        </Cell>
        <Cell label={D.colCheckin}>
          <span className={cn("text-[13.5px]", !r.lastCheckin && "text-faint")}>{r.lastCheckin ? relativeDays(r.lastCheckin.slice(0, 10)) : D.never}</span>
        </Cell>
        <Cell label={D.colWeight}>
          {w ? (
            <span className="inline-flex items-center gap-1.5 tabular"><b>{formatNumber(w.now, 1)}</b><span className="text-muted">kg</span>
              {w.delta != null && <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10.5px]", w.delta < 0 ? "bg-mint-soft text-mint-ink" : w.delta > 0 ? "bg-accent-soft text-accent" : "bg-subtle text-muted")}><TrendIcon className="size-3" />{w.delta > 0 ? "+" : ""}{formatNumber(w.delta, 1)}</span>}
            </span>
          ) : <span className="text-faint">–</span>}
        </Cell>
      </Link>
    </li>
  );
}

function Cell({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="grid min-w-0 content-center text-sm">
      <span className="eyebrow mb-1 flex items-center gap-1 text-[9.5px] md:hidden">{icon}{label}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}
