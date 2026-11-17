import Link from "next/link";
import { ChevronRight, ClipboardList, CupSoda, Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCheckinSeries } from "@/lib/data/checkins";
import { getSubmission, getTemplateById, listFiles, listSubmissions, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatWeekdayDate } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinBadge } from "@/components/clients/status";
import { AnswersView } from "@/components/questionnaire/answers-view";
import { CheckinTrends } from "@/components/checkins/checkin-trends";
import { FilesGrid } from "@/components/files/files-grid";
import { ReviewButton } from "../../izvestaji/review-button";

export async function InitialTab({ clientId, version }: { clientId: string; version?: string }) {
  const subs = (await listSubmissions(clientId, "initial")).filter((s) => s.status !== "draft");
  const draft = (await listSubmissions(clientId, "initial")).find((s) => s.status === "draft");
  const current = subs.find((s) => s.id === version) ?? subs[0];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="grid content-start gap-4">
        {!current ? (
          <EmptyState icon={<ClipboardList />} title={draft ? `${t.questionnaire.status.draft}` : t.questionnaire.status.notStarted} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Badge tone={current.status === "reviewed" ? "success" : "accent"}>{t.questionnaire.status[current.status]}</Badge>
                {current.submitted_at && formatDate(current.submitted_at)}
              </div>
              <ReviewButton submissionId={current.id} reviewed={current.status === "reviewed"} />
            </div>
            <InitialAnswers submissionId={current.id} templateId={current.template_id} />
          </>
        )}
      </div>
      <div className="grid content-start gap-4">
        {subs.length > 1 && (
          <Card>
            <CardHeader title={t.questionnaire.history} />
            <CardBody className="grid gap-1">
              {subs.map((s) => (
                <Link key={s.id} href={`?tab=initial&v=${s.id}`} className={cn("flex items-center justify-between rounded-[12px] px-3 py-2 text-sm", s.id === current?.id ? "bg-subtle font-semibold" : "hover:bg-hover")}>
                  {formatDate(s.submitted_at ?? s.created_at)} <Badge tone={s.status === "reviewed" ? "success" : "accent"}>{t.questionnaire.status[s.status]}</Badge>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}
        <DiaryCard clientId={clientId} />
      </div>
    </div>
  );
}

async function InitialAnswers({ submissionId, templateId }: { submissionId: string; templateId: string }) {
  const [template, sub, files] = await Promise.all([getTemplateById(templateId), getSubmission(submissionId), listFiles({ submissionId })]);
  if (!template || !sub) return null;
  return <AnswersView template={template} answers={sub.answers} files={await signFiles(files)} />;
}

async function DiaryCard({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data: days } = await supabase.from("nutrition_diary_days").select("id, day_index, diary_date, day_type, notes, submitted_at").eq("client_id", clientId).order("day_index");
  const ids = (days ?? []).map((d) => d.id as string);
  const { data: items } = ids.length ? await supabase.from("nutrition_diary_items").select("id, day_id, eaten_at, food_name, quantity, is_drink, notes").in("day_id", ids).order("eaten_at", { nullsFirst: false }) : { data: [] };
  const photos = ids.length ? await signFiles((await listFiles({ clientId, kinds: ["meal_photo"] })).filter((f) => f.diary_day_id)) : [];
  return (
    <Card>
      <CardHeader title={t.diary.coachTitle} />
      <CardBody className="grid gap-4">
        {!days?.length ? <p className="text-sm text-muted">{t.diary.notStarted}</p> : days.map((d) => (
          <div key={d.id as string} className="rounded-[14px] border border-line p-3.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-bold">{t.diary.day(d.day_index as number)}<span className="ml-2 text-sm font-normal text-muted">{d.diary_date ? formatWeekdayDate(d.diary_date as string) : ""}</span></span>
              {d.submitted_at ? <Badge tone="success">{t.diary.daySubmitted}</Badge> : <Badge>{t.questionnaire.status.draft}</Badge>}
            </div>
            <ul className="grid gap-1.5 text-sm">
              {(items ?? []).filter((i) => i.day_id === d.id).map((i) => (
                <li key={i.id as string} className="flex gap-2">
                  <span className="w-11 shrink-0 font-semibold tabular text-muted">{(i.eaten_at as string | null)?.slice(0, 5) ?? "–"}</span>
                  {i.is_drink ? <CupSoda className="mt-0.5 size-3.5 shrink-0 text-faint" /> : <Utensils className="mt-0.5 size-3.5 shrink-0 text-faint" />}
                  <span>{i.food_name as string}{i.quantity ? <span className="text-muted"> · {i.quantity as string}</span> : null}{i.notes ? <span className="block text-xs text-muted">{i.notes as string}</span> : null}</span>
                </li>
              ))}
            </ul>
            {d.notes && <p className="mt-2 whitespace-pre-wrap rounded-[10px] bg-subtle px-3 py-2 text-[13px]">{d.notes as string}</p>}
            {photos.filter((p) => p.diary_day_id === d.id).length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {photos.filter((p) => p.diary_day_id === d.id).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.id} href={p.url ?? undefined} target="_blank" rel="noopener noreferrer"><img src={p.url ?? ""} alt={p.file_name} className="aspect-square w-full rounded-[8px] object-cover" /></a>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export async function CheckinsTab({ clientId }: { clientId: string }) {
  const [subs, series] = await Promise.all([listSubmissions(clientId, "checkin"), getCheckinSeries(clientId, 26)]);
  const list = subs.filter((s) => s.status !== "draft");
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="content-start">
        <CardHeader title={t.checkins.history} />
        <CardBody>
          {list.length === 0 ? <p className="text-sm text-muted">{t.checkins.noHistory}</p> : (
            <ul className="-mx-2 grid">
              {list.map((s) => (
                <li key={s.id}>
                  <Link href={`/trener/izvestaji/${s.id}`} className="flex items-center gap-2 rounded-[12px] px-2 py-2.5 text-sm hover:bg-hover">
                    <span className="flex-1 font-semibold tabular">{formatDate(s.period_start)} – {formatDate(s.period_end)}</span>
                    <CheckinBadge status={s.status} /><ChevronRight className="size-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <CheckinTrends series={series} />
    </div>
  );
}

export async function FilesTab({ clientId }: { clientId: string }) {
  const files = await signFiles(await listFiles({ clientId }));
  return <Card><CardBody className="pt-5 sm:pt-6"><FilesGrid files={files} canDelete /></CardBody></Card>;
}
