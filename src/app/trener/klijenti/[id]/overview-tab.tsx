import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMeasurements } from "@/lib/data/clients";
import { getClientWeek } from "@/lib/data/client-home";
import { WeekLegend, WeekStrip } from "@/components/plan/week-strip";
import { ComplianceTable } from "@/components/plan/compliance-table";
import type { ClientRow, NoteRow, ProgramSummary, SubmissionRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { ageFromBirthDate, formatDate, formatNumber } from "@/lib/utils/format";
import { formatPhone } from "@/lib/utils/phone";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { TrendChart } from "@/components/charts/trend-chart";
import { CheckinBadge } from "@/components/clients/status";

export async function OverviewTab({ client, pinned }: { client: ClientRow; pinned: NoteRow[] }) {
  const supabase = await createClient();
  const [week, measurements, strength, running, nutrition, submissions] = await Promise.all([
    getClientWeek(client.id, { snapshot: false, historyWeeks: 6, startDate: client.start_date }),
    getMeasurements(client.id),
    supabase.from("training_programs").select("id, client_id, name, status, start_date").eq("client_id", client.id).eq("status", "active"),
    supabase.from("running_programs").select("id, client_id, name, status, start_date").eq("client_id", client.id).eq("status", "active"),
    supabase.from("nutrition_plans").select("id, client_id, name, status, start_date").eq("client_id", client.id).eq("status", "active"),
    supabase.from("questionnaire_submissions").select("id, kind, status, period_start, period_end, submitted_at").eq("client_id", client.id).order("created_at", { ascending: false }),
  ]);
  const weights = [...measurements].reverse().filter((m) => m.weight_kg != null).map((m) => ({ date: m.measured_on, value: m.weight_kg }));
  const current = weights.at(-1)?.value ?? null;
  const change = weights.length > 1 && current != null ? current - (weights[0].value as number) : null;
  const age = ageFromBirthDate(client.birth_date);
  const subs = (submissions.data ?? []) as SubmissionRow[];
  const initial = subs.find((s) => s.kind === "initial" && s.status !== "draft") ?? subs.find((s) => s.kind === "initial");
  const lastCheckin = subs.filter((s) => s.kind === "checkin" && s.status !== "draft").sort((a, b) => (b.period_start ?? "").localeCompare(a.period_start ?? ""))[0];
  const plans: { label: string; p: ProgramSummary }[] = [
    ...((strength.data ?? []) as ProgramSummary[]).map((p) => ({ label: t.nav.coach.strength, p })),
    ...((running.data ?? []) as ProgramSummary[]).map((p) => ({ label: t.nav.coach.running, p })),
    ...((nutrition.data ?? []) as ProgramSummary[]).map((p) => ({ label: t.nav.coach.nutrition, p })),
  ];

  return (
    <div className="stagger grid gap-4 lg:grid-cols-3">
      <div className="stagger grid gap-4 sm:grid-cols-3 lg:col-span-3">
        <StatCard label={t.profile.overview.currentWeight} value={current != null ? `${formatNumber(current)} kg` : "–"} hint={weights.at(-1) ? formatDate(weights.at(-1)!.date) : t.common.noData} />
        <StatCard label={t.profile.overview.weightChange} value={change != null ? `${change > 0 ? "+" : ""}${formatNumber(change)} kg` : "–"} hint={weights[0] ? `${t.common.from} ${formatDate(weights[0].date)}` : undefined} />
        <StatCard label={t.profile.overview.since} value={formatDate(client.start_date)} />
      </div>

      <Card className="lg:col-span-3">
        <CardHeader title={t.profile.overview.thisWeek} description={[week.strength && `${t.clientHome.legendStrength} ${week.strength.done}/${week.strength.planned}`, week.running && (week.running.targetMin != null ? `${t.nav.client.running} ${week.running.min}/${week.running.targetMin} min` : `${t.nav.client.running} ${formatNumber(week.running.km, 1)}${week.running.target ? `/${formatNumber(week.running.target, 0)}` : ""} km`)].filter(Boolean).join(" · ") || t.profile.overview.noPrograms} action={<WeekLegend />} />
        <CardBody className="pt-4">
          {week.strength || week.running ? <WeekStrip week={week} hrefFor={(it) => (it.kind === "strength" ? `/trener/trening/${it.programId}` : `/trener/trcanje/${it.programId}`)} /> : <p className="text-sm text-muted">{t.profile.overview.noPrograms}</p>}
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader title={t.profile.overview.compliance} description={t.profile.overview.complianceDesc} />
        <CardBody className="pt-3"><ComplianceTable rows={week.history} /></CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title={t.progress.weight} action={<Link href={`?tab=measurements`} className="text-sm font-semibold text-accent">{t.common.view}</Link>} />
        <CardBody>
          {weights.length > 1 ? <TrendChart data={weights} unit="kg" ariaLabel={t.progress.weight} /> : <p className="py-6 text-sm text-muted">{t.progress.noData}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.profile.overview.contact} />
        <CardBody className="grid gap-3 text-sm">
          <a href={`mailto:${client.email}`} className="flex items-center gap-2.5 text-ink-2 hover:text-ink"><Mail className="size-4 text-muted" /><span className="truncate">{client.email}</span></a>
          <div className="flex items-center gap-2.5 text-ink-2"><Phone className="size-4 text-muted" />{client.phone_e164 ? formatPhone(client.phone_e164) : <span className="text-faint">{t.common.notSet}</span>}</div>
          <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <div><dt className="text-xs text-muted">{t.profile.overview.age}</dt><dd className="font-semibold tabular">{age ?? "–"}</dd></div>
            <div><dt className="text-xs text-muted">{t.profile.overview.height}</dt><dd className="font-semibold tabular">{client.height_cm ? `${formatNumber(client.height_cm)} cm` : "–"}</dd></div>
          </dl>
          {client.goal && <div className="border-t border-line pt-4"><div className="text-xs text-muted">{t.profile.overview.goal}</div><p className="mt-1 whitespace-pre-wrap leading-relaxed">{client.goal}</p></div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.profile.overview.currentPrograms} />
        <CardBody>
          {plans.length ? (
            <ul className="grid gap-2">
              {plans.map(({ label, p }) => (
                <li key={p.id} className="rounded-[12px] bg-subtle px-3.5 py-2.5">
                  <div className="text-xs font-semibold text-muted">{label}</div>
                  <div className="font-semibold">{p.name}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">{t.profile.overview.noPrograms}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.questionnaire.initialTitle} />
        <CardBody className="text-sm">
          {initial ? (
            <div className="flex items-center justify-between gap-2">
              <Badge tone={initial.status === "draft" ? "neutral" : initial.status === "submitted" ? "accent" : "success"}>{t.questionnaire.status[initial.status]}</Badge>
              {initial.submitted_at && <span className="text-muted">{formatDate(initial.submitted_at)}</span>}
            </div>
          ) : <Badge tone="outline">{t.questionnaire.status.notStarted}</Badge>}
          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-1.5 text-xs text-muted">{t.profile.overview.lastCheckin}</div>
            {lastCheckin ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular">{formatDate(lastCheckin.period_start)} – {formatDate(lastCheckin.period_end)}</span>
                <CheckinBadge status={lastCheckin.status} />
              </div>
            ) : <span className="text-muted">{t.checkins.noHistory}</span>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.profile.notes.pinned} action={<Link href={`?tab=notes`} className="text-sm font-semibold text-accent">{t.common.view}</Link>} />
        <CardBody>
          {pinned.length ? (
            <ul className="grid gap-2">{pinned.slice(0, 3).map((n) => <li key={n.id} className="line-clamp-4 whitespace-pre-wrap rounded-[12px] bg-accent-soft/50 px-3.5 py-2.5 text-sm leading-relaxed">{n.body}</li>)}</ul>
          ) : <p className="text-sm text-muted">{t.profile.notes.empty}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
