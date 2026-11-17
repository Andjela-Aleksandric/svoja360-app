import { ClipboardList } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getConsents, getSubmission, getTemplate, listFiles, listSubmissions, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";
import { AnswersView } from "@/components/questionnaire/answers-view";
import { StartButton } from "./start-button";

export const metadata = { title: t.questionnaire.initialTitle };

export default async function InitialQuestionnairePage() {
  const viewer = await requireClient();
  const template = await getTemplate("initial");
  if (!template) return <EmptyState title={t.errors.loadFailed} />;
  const subs = await listSubmissions(viewer.client.id, "initial");
  const draft = subs.find((s) => s.status === "draft");

  if (draft) {
    const [submission, consents, files] = await Promise.all([getSubmission(draft.id), getConsents(viewer.client.id), listFiles({ submissionId: draft.id })]);
    const signed = await signFiles(files);
    // Prefill name and email on a brand-new questionnaire.
    const prefilled: Record<string, unknown> = {};
    for (const q of template.sections.flatMap((s) => s.questions)) {
      if (q.code === "full_name") prefilled[q.id] = viewer.client.full_name;
      if (q.code === "email") prefilled[q.id] = viewer.email;
      if (q.code === "birth_date" && viewer.client.birth_date) prefilled[q.id] = viewer.client.birth_date;
    }
    return (
      <QuestionnaireForm
        template={template}
        submission={{ id: draft.id, status: draft.status, current_step: draft.current_step, answers: submission!.answers }}
        prefilled={prefilled}
        consents={consents}
        files={signed.map((f) => ({ id: f.id, question_id: f.question_id, file_name: f.file_name, mime_type: f.mime_type, photo_angle: f.photo_angle, url: f.url }))}
        title={t.questionnaire.initialTitle}
        intro={t.questionnaire.initialIntro}
        doneHref="/klijent"
        withConsentStep
      />
    );
  }

  const latest = subs[0];
  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t.questionnaire.initialTitle} />
        <EmptyState icon={<ClipboardList />} title={t.questionnaire.initialStartTitle} description={t.questionnaire.initialIntro}
          action={<StartButton kind="initial" label={t.clientHome.startInitial} href="/klijent/upitnik" />} />
      </div>
    );
  }

  const [submission, files] = await Promise.all([getSubmission(latest.id), listFiles({ submissionId: latest.id })]);
  const signed = await signFiles(files);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.questionnaire.initialTitle}
        description={latest.submitted_at ? `${t.questionnaire.status[latest.status]} ${formatDate(latest.submitted_at)}` : undefined}
        action={<StartButton kind="initial" variant="secondary" label={t.questionnaire.newVersion} href="/klijent/upitnik" />}
      />
      <div className="mb-4"><Badge tone={latest.status === "reviewed" ? "success" : "accent"}>{t.questionnaire.status[latest.status]}</Badge></div>
      <AnswersView template={template} answers={submission!.answers} files={signed} />
    </div>
  );
}
