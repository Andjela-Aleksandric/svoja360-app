import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConsents, getSubmission, getTemplateById, listFiles, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { previousWeek } from "@/lib/utils/periods";
import { PageHeader } from "@/components/ui/page-header";
import { CheckinBadge } from "@/components/clients/status";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";
import { AnswersView } from "@/components/questionnaire/answers-view";

export default async function ClientCheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireClient();
  const { id } = await params;
  if (id === "trenutni") {
    const supabase = await createClient();
    const { data } = await supabase.from("questionnaire_submissions").select("id").eq("client_id", viewer.client.id).eq("kind", "checkin").eq("period_start", previousWeek().start).maybeSingle();
    redirect(data ? `/klijent/izvestaji/${data.id}` : "/klijent/izvestaji");
  }
  const sub = await getSubmission(id);
  if (!sub || sub.client_id !== viewer.client.id || sub.kind !== "checkin") notFound();
  const template = await getTemplateById(sub.template_id);
  if (!template) notFound();
  const files = await signFiles(await listFiles({ submissionId: id }));
  const title = t.checkins.period(formatDate(sub.period_start), formatDate(sub.period_end));
  const isCurrent = sub.period_start === previousWeek().start;

  if (sub.status !== "reviewed" && isCurrent) {
    const consents = await getConsents(viewer.client.id);
    return (
      <QuestionnaireForm template={template} submission={{ id, status: sub.status, current_step: sub.current_step, answers: sub.answers }} consents={consents}
        files={files.map((f) => ({ id: f.id, question_id: f.question_id, file_name: f.file_name, mime_type: f.mime_type, photo_angle: f.photo_angle, url: f.url }))}
        title={title} intro={t.checkins.clientSubtitle} doneHref="/klijent/izvestaji" />
    );
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/klijent/izvestaji" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.checkins.title}</Link>
      <PageHeader title={title} action={<CheckinBadge status={sub.status} />} />
      <AnswersView template={template} answers={sub.answers} files={files} />
    </div>
  );
}
