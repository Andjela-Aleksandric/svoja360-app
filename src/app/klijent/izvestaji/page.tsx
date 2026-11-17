import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getClientTasks } from "@/lib/data/client-home";
import { listSubmissions } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatWeekdayDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinBadge } from "@/components/clients/status";
import { StartButton } from "../upitnik/start-button";

export const metadata = { title: t.checkins.title };

export default async function ClientCheckinsPage() {
  const viewer = await requireClient();
  const [{ checkin }, history] = await Promise.all([getClientTasks(viewer.client.id, viewer.client.start_date), listSubmissions(viewer.client.id, "checkin")]);
  const p = checkin.period;
  const current = history.find((h) => h.period_start === p.start);
  const editable = current && current.status !== "reviewed";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.checkins.title} description={t.checkins.clientSubtitle} />
      {checkin.status !== "notDue" ? (
        <Card className="mb-6 overflow-hidden">
          <CardBody className="grid gap-4 pt-5 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[17px] font-bold">{t.checkins.period(formatDate(p.start), formatDate(p.end))}</div>
                <div className="mt-1 text-sm text-muted">{checkin.overdue && checkin.status !== "submitted" && checkin.status !== "reviewed" ? t.checkins.overdue : t.checkins.due(`${formatWeekdayDate(checkin.deadline.date)} ${checkin.deadline.hour}:00`)}</div>
              </div>
              <CheckinBadge status={checkin.status} />
            </div>
            {!current ? (
              <StartButton kind="checkin" label={t.checkins.start} href="/klijent/izvestaji/trenutni" size="lg" variant="accent" />
            ) : (
              <Link href={`/klijent/izvestaji/${current.id}`} className="inline-flex h-12 items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-white">
                {current.status === "draft" ? t.checkins.continue : editable ? t.checkins.edit : t.checkins.view}
              </Link>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card className="mb-6"><CardBody className="pt-5 text-sm text-muted sm:pt-6">{t.clientHome.checkinNotDue}</CardBody></Card>
      )}

      <h2 className="mb-3 text-[15px] font-bold">{t.checkins.history}</h2>
      {history.filter((h) => h.status !== "draft").length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title={t.checkins.noHistory} />
      ) : (
        <ul className="overflow-hidden rounded-[20px] border border-line bg-surface">
          {history.filter((h) => h.status !== "draft").map((h) => (
            <li key={h.id} className="border-b border-line/70 last:border-0">
              <Link href={`/klijent/izvestaji/${h.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-hover">
                <span className="flex-1 font-semibold tabular">{formatDate(h.period_start)} – {formatDate(h.period_end)}</span>
                <CheckinBadge status={h.status} />
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
