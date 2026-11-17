import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getClient } from "@/lib/data/clients";
import { getCheckinSeries } from "@/lib/data/checkins";
import { getSubmission, getTemplateById, listFiles, signFiles } from "@/lib/data/questionnaire";
import type { NoteRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { CheckinBadge } from "@/components/clients/status";
import { WhatsAppButton } from "@/components/clients/wa-button";
import { AnswersView } from "@/components/questionnaire/answers-view";
import { CheckinTrends } from "@/components/checkins/checkin-trends";
import { NotesPanel } from "../../klijenti/[id]/notes-panel";
import { ReviewButton } from "../review-button";

export default async function CoachCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;
  const sub = await getSubmission(id);
  if (!sub || sub.kind !== "checkin" || sub.status === "draft") notFound();
  const [template, client, files, series] = await Promise.all([getTemplateById(sub.template_id), getClient(sub.client_id), listFiles({ submissionId: id }), getCheckinSeries(sub.client_id, 12)]);
  if (!template || !client) notFound();
  const supabase = await createClient();
  const { data: prevRow } = await supabase.from("questionnaire_submissions").select("id").eq("client_id", sub.client_id).eq("kind", "checkin").neq("status", "draft").lt("period_start", sub.period_start!).order("period_start", { ascending: false }).limit(1).maybeSingle();
  const prev = prevRow ? await getSubmission(prevRow.id as string) : null;
  const [{ data: notes }, { data: coaches }] = await Promise.all([
    supabase.from("coach_notes").select("*").eq("submission_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "coach"),
  ]);
  const authors = Object.fromEntries((coaches ?? []).map((p) => [p.id, (p.full_name as string) || (p.email as string)]));

  return (
    <>
      <Link href="/trener/izvestaji" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.checkins.title}</Link>
      <PageHeader
        eyebrow={<Link href={`/trener/klijenti/${client.id}`} className="hover:text-ink">{client.full_name}</Link>}
        title={t.checkins.period(formatDate(sub.period_start), formatDate(sub.period_end))}
        description={sub.submitted_at ? `${t.questionnaire.status.submitted} ${formatDateTime(sub.submitted_at)}` : undefined}
        action={<><CheckinBadge status={sub.status} /><WhatsAppButton phone={client.phone_e164} /><ReviewButton submissionId={id} reviewed={sub.status === "reviewed"} /></>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          {prev && <p className="text-[13px] text-muted">{t.checkins.comparedTo(formatDate(prev.period_start), formatDate(prev.period_end))}</p>}
          <AnswersView template={template} answers={sub.answers} files={await signFiles(files)} compareTo={prev?.answers} highlight />
        </div>
        <div className="grid content-start gap-4">
          <NotesPanel clientId={client.id} notes={(notes ?? []) as NoteRow[]} authors={authors} submissionId={id} compact />
          <CheckinTrends series={series} compact />
        </div>
      </div>
    </>
  );
}
