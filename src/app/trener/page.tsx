import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ClipboardCheck, Dumbbell, Footprints, Apple, UserPlus, Activity, Sparkles } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { getCoachDashboard } from "@/lib/data/dashboard";
import { t } from "@/lib/i18n/sr";
import { firstName, formatDate, formatDateTime, greeting } from "@/lib/utils/format";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WhatsAppButton } from "@/components/clients/wa-button";
import { PageTransition } from "@/components/shell/page-transition";

export const metadata = { title: t.nav.coach.dashboard };

const reasonTone = { pain: "danger", highStress: "warning", missingCheckin: "danger", lowAdherence: "warning", initialPending: "info", noProgram: "neutral" } as const;

export default async function CoachDashboard() {
  const viewer = await requireCoach();
  const { stats, attention, activity, period } = await getCoachDashboard();
  const quick = [
    { href: "/trener/klijenti/novi", label: t.dashboard.addClient, icon: UserPlus },
    { href: "/trener/izvestaji", label: t.dashboard.reviewCheckins, icon: ClipboardCheck },
    { href: "/trener/trening/novi", label: t.dashboard.createProgram, icon: Dumbbell },
    { href: "/trener/trcanje/novi", label: t.dashboard.createRun, icon: Footprints },
    { href: "/trener/ishrana/novi", label: t.dashboard.createNutrition, icon: Apple },
  ];

  return (
    <PageTransition>
      <PageHeader eyebrow={formatDate(new Date())} title={`${greeting()}, ${firstName(viewer.fullName ?? "")}`.replace(/, $/, "")} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t.dashboard.activeClients} value={stats.active} />
        <StatCard label={t.dashboard.newClients} value={stats.newThisMonth} />
        <Link href="/trener/izvestaji" className="rounded-[20px] transition-transform hover:-translate-y-0.5">
          <StatCard label={t.dashboard.pendingCheckins} value={stats.pending} className={stats.pending ? "border-accent/40" : undefined} hint={stats.pending ? t.checkins.toReview : undefined} />
        </Link>
        <StatCard label={t.dashboard.reviewedCheckins} value={stats.reviewedThisWeek} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={t.dashboard.needsAttention} description={`${formatDate(period.start)} – ${formatDate(period.end)}`} />
          <CardBody>
            {attention.length === 0 ? (
              <EmptyState icon={<Sparkles />} title={t.dashboard.needsAttentionEmpty} className="border-0 py-8" />
            ) : (
              <ul className="-mx-2 grid">
                {attention.slice(0, 10).map((a) => (
                  <li key={a.client.id} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 hover:bg-hover">
                    <Link href={`/trener/klijenti/${a.client.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={a.client.full_name} size={38} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{a.client.full_name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.reasons.map((r) => (
                            <Badge key={r} tone={reasonTone[r]}>{(r === "pain" || r === "missingCheckin") && <AlertTriangle className="size-3" />}{t.dashboard.reasons[r]}</Badge>
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
            <CardHeader title={t.dashboard.quickActions} />
            <CardBody className="grid gap-1.5">
              {quick.map((q) => (
                <Link key={q.href} href={q.href} className="group flex h-12 items-center gap-3 rounded-[14px] border border-line px-3.5 text-sm font-semibold transition-colors hover:border-ink">
                  <q.icon className="size-[18px] text-muted group-hover:text-accent" />
                  <span className="flex-1">{q.label}</span>
                  <ArrowUpRight className="size-4 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.dashboard.recentActivity} />
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState icon={<Activity />} title={t.dashboard.recentActivityEmpty} className="border-0 py-6" />
              ) : (
                <ol className="relative grid gap-3.5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
                  {activity.map((a) => (
                    <li key={a.id} className="relative pl-6">
                      <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-surface bg-accent" aria-hidden />
                      <Link href={a.href} className="block text-sm hover:text-accent">
                        <span className="font-semibold">{a.clientName}</span> <span className="text-muted">· {t.dashboard.activity[a.kind]}{a.detail ? `: ${a.detail}` : ""}</span>
                      </Link>
                      <div className="text-xs text-faint">{formatDateTime(a.at)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
