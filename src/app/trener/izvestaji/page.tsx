import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { listCheckinsForCoach } from "@/lib/data/checkins";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { lastPeriods } from "@/lib/utils/periods";
import { PageHeader } from "@/components/ui/page-header";
import { LinkTabs } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinBadge } from "@/components/clients/status";
import { WhatsAppButton } from "@/components/clients/wa-button";
import { PeriodSelect } from "./period-select";

export const metadata = { title: t.checkins.title };

export default async function CoachCheckinsPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  await requireCoach();
  const sp = await searchParams;
  const periods = lastPeriods(12);
  const period = periods.find((p) => p.start === sp.period) ?? periods[0];
  const tab = sp.tab === "reviewed" || sp.tab === "missing" ? sp.tab : "toReview";
  const data = await listCheckinsForCoach(period.start);
  const q = (k: string) => `/trener/izvestaji?period=${period.start}&tab=${k}`;

  return (
    <>
      <PageHeader title={t.checkins.title} description={t.checkins.coachSubtitle}
        action={<PeriodSelect value={period.start} options={periods.map((p) => ({ value: p.start, label: `${formatDate(p.start)} – ${formatDate(p.end)}` }))} />} />
      <div className="mb-5">
        <LinkTabs layoutId="checkin-tabs" active={tab} items={[
          { key: "toReview", label: `${t.checkins.toReview} · ${data.toReview.length}`, href: q("toReview") },
          { key: "reviewed", label: `${t.checkins.reviewedTab} · ${data.reviewed.length}`, href: q("reviewed") },
          { key: "missing", label: `${t.checkins.missingTab} · ${data.missing.length}`, href: q("missing") },
        ]} />
      </div>
      {tab !== "missing" ? (
        (tab === "toReview" ? data.toReview : data.reviewed).length === 0 ? <EmptyState icon={<ClipboardCheck />} title={t.checkins.empty} /> : (
          <ul className="overflow-hidden rounded-[20px] border border-line bg-surface">
            {(tab === "toReview" ? data.toReview : data.reviewed).map((r) => (
              <li key={r.id} className="border-b border-line/70 last:border-0">
                <Link href={`/trener/izvestaji/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-hover sm:px-5">
                  <Avatar name={r.client_name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.client_name}</div>
                    <div className="text-xs text-muted">{r.submitted_at ? formatDateTime(r.submitted_at) : ""}</div>
                  </div>
                  <CheckinBadge status={r.status as "submitted" | "reviewed"} />
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : data.missing.length === 0 ? <EmptyState icon={<ClipboardCheck />} title={t.checkins.empty} /> : (
        <ul className="overflow-hidden rounded-[20px] border border-line bg-surface">
          {data.missing.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0 sm:px-5">
              <Link href={`/trener/klijenti/${c.id}?tab=checkins`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={c.full_name} size={38} /><span className="truncate font-semibold">{c.full_name}</span>
              </Link>
              <WhatsAppButton phone={c.phone_e164} compact />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
