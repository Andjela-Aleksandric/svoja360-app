import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getClientTasks } from "@/lib/data/client-home";
import { getMeasurements } from "@/lib/data/clients";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { firstName, formatDate, formatWeekdayDate, greeting } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CheckinBadge } from "@/components/clients/status";
import { TrendChart } from "@/components/charts/trend-chart";
import { ClientToday } from "./today";

export const metadata = { title: t.nav.client.home };

const stepLabel = { initial: t.clientHome.startInitial, initialContinue: t.clientHome.continueInitial, diary: t.clientHome.startDiary, checkin: t.clientHome.doCheckin, checkinContinue: t.clientHome.continueCheckin } as const;

export default async function ClientHome() {
  const viewer = await requireClient();
  const [{ steps, checkin }, measurements] = await Promise.all([getClientTasks(viewer.client.id, viewer.client.start_date), getMeasurements(viewer.client.id)]);
  const weights = [...measurements].reverse().filter((m) => m.weight_kg != null).slice(-12).map((m) => ({ date: m.measured_on, value: m.weight_kg }));

  return (
    <>
      <PageHeader eyebrow={formatWeekdayDate(new Date())} title={`${greeting()}, ${firstName(viewer.client.full_name)}`} />

      {steps.length > 0 && (
        <section aria-label={t.clientHome.nextAction} className="stagger mb-5 grid gap-3">
          {steps.map((s, i) => (
            <Link key={s.key} href={s.href}
              className={cn("group lift flex items-center gap-4 rounded-[22px] p-5", i === 0 ? "sheen bg-ink text-white" : "border border-line bg-surface hover:border-line-strong")}>
              <div className="min-w-0 flex-1">
                <div className={cn("text-xs font-semibold uppercase tracking-wide", i === 0 ? "text-white/60" : "text-muted")}>{t.clientHome.nextAction}</div>
                <div className="mt-1 text-[17px] font-bold">{stepLabel[s.key]}</div>
                <div className={cn("mt-0.5 text-sm", i === 0 ? "text-white/70" : "text-muted")}>
                  {s.deadline ? (s.overdue ? t.checkins.overdue : t.checkins.due(`${formatWeekdayDate(s.deadline.date)} ${s.deadline.hour}:00`)) : t.clientHome.stepHelp[s.key]}
                </div>
              </div>
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-transform group-hover:translate-x-0.5", i === 0 ? "bg-accent text-white" : "bg-subtle")}><ArrowRight className="size-5" /></span>
            </Link>
          ))}
        </section>
      )}

      <div className="stagger grid gap-4 lg:grid-cols-2">
        <ClientToday clientId={viewer.client.id} />
        <Card>
          <CardHeader title={t.clientHome.checkinStatus} description={`${formatDate(checkin.period.start)} – ${formatDate(checkin.period.end)}`}
            action={checkin.status !== "notDue" ? <CheckinBadge status={checkin.status} /> : undefined} />
          <CardBody>
            <p className="flex items-center gap-2 text-sm text-muted"><CalendarClock className="size-4" />
              {checkin.status === "notDue" ? t.clientHome.checkinNotDue : checkin.status === "submitted" || checkin.status === "reviewed" ? t.checkins.submitted : checkin.overdue ? t.checkins.overdue : t.checkins.due(`${formatWeekdayDate(checkin.deadline.date)} ${checkin.deadline.hour}:00`)}
            </p>
            <Link href="/klijent/izvestaji" className="mt-3 inline-block text-sm font-semibold text-accent">{t.checkins.history}</Link>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t.progress.weight} action={<Link href="/klijent/napredak" className="text-sm font-semibold text-accent">{t.nav.client.progress}</Link>} />
          <CardBody>{weights.length > 1 ? <TrendChart data={weights} unit="kg" ariaLabel={t.progress.weight} height={180} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}</CardBody>
        </Card>
      </div>
    </>
  );
}
