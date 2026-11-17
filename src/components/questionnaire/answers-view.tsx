import { FileText, Film, Lock, MapPin } from "lucide-react";
import type { Answers, Question, Template } from "@/lib/questionnaire/logic";
import { byCode, isEmpty, isVisible } from "@/lib/questionnaire/logic";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface ViewFile { id: string; question_id: string | null; file_name: string; mime_type: string; photo_angle: "front" | "side" | "back" | null; url: string | null }

export function formatAnswer(q: Question, v: unknown): string {
  if (isEmpty(v)) return "";
  switch (q.type) {
    case "number": return `${formatNumber(v as number, 2)}${q.unit ? ` ${q.unit}` : ""}`;
    case "scale": return `${v} / ${q.options?.max ?? 10}`;
    case "date": return formatDate(v as string);
    case "yes_no": return v ? t.common.yes : t.common.no;
    case "multi_choice": return (v as string[]).join(", ");
    case "planned_done": { const p = v as { planned: number | null; done: number | null }; return `${p.done ?? "–"} ${t.common.of} ${p.planned ?? "–"}`; }
    case "measurements": return Object.entries(v as Record<string, number | null>).filter(([, x]) => x != null).map(([k, x]) => `${(t.questionnaire.measurements as Record<string, string>)[k] ?? k} ${formatNumber(x as number)} cm`).join(" · ");
    default: return String(v);
  }
}

/** Read-only answers, grouped by section. Used by coaches and by clients for their own history. */
export function AnswersView({ template, answers, files, compareTo, highlight }: { template: Template; answers: Answers; files: ViewFile[]; compareTo?: Answers; highlight?: boolean }) {
  const codes = byCode(template);
  return (
    <div className="grid gap-4">
      {template.sections.map((s) => {
        const qs = s.questions.filter((q) => isVisible(q, answers, codes));
        if (!qs.length) return null;
        return (
          <section key={s.id} className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <h3 className="mb-4 text-[15px] font-bold tracking-tight">{s.title}</h3>
            <dl className="grid gap-4">
              {qs.map((q) => {
                const v = answers[q.id];
                const qFiles = files.filter((f) => f.question_id === q.id);
                const prev = compareTo ? compareTo[q.id] : undefined;
                const delta = compareTo && (q.type === "number" || q.type === "scale") && typeof v === "number" && typeof prev === "number" ? v - prev : null;
                const flag = highlight && ((q.code === "strength_pain" && v === true) || (q.code === "stress" && Number(v) >= 8) || (q.code === "nutrition_adherence" && Number(v) <= 4));
                return (
                  <div key={q.id} className="grid gap-1 border-b border-line/70 pb-4 last:border-0 last:pb-0">
                    <dt className="flex items-start gap-2 text-[13px] font-medium text-muted">
                      <span className="flex-1">{q.label}</span>
                      {q.sensitive && <Lock className="mt-0.5 size-3.5 shrink-0" aria-label={t.questionnaire.sensitive} />}
                    </dt>
                    <dd className={cn("whitespace-pre-wrap text-[15px] leading-relaxed text-ink", flag && "font-semibold text-danger")}>
                      {q.type === "file" ? null : isEmpty(v) ? <span className="text-faint">{t.questionnaire.noAnswer}</span> : formatAnswer(q, v)}
                      {delta !== null && delta !== 0 && (
                        <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular", "bg-subtle text-muted")}>
                          {delta > 0 ? "+" : ""}{formatNumber(delta, 2)}
                        </span>
                      )}
                    </dd>
                    {q.type === "file" && (qFiles.length ? (
                      <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {qFiles.map((f) => (
                          <li key={f.id}>
                            <a href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-[12px] border border-line bg-subtle">
                              {f.url && f.mime_type.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={f.url} alt={f.file_name} loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-[1.03]" />
                              ) : (
                                <div className="grid aspect-[3/4] place-items-center p-2 text-center">
                                  <div>
                                    {f.mime_type.startsWith("video/") ? <Film className="mx-auto size-6 text-muted" /> : f.mime_type.includes("pdf") ? <FileText className="mx-auto size-6 text-muted" /> : <MapPin className="mx-auto size-6 text-muted" />}
                                    <div className="mt-1.5 line-clamp-2 break-all text-[11px] text-ink-2">{f.file_name}</div>
                                  </div>
                                </div>
                              )}
                              {f.photo_angle && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">{t.questionnaire.angles[f.photo_angle]}</span>}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-[15px] text-faint">{t.questionnaire.noAnswer}</span>)}
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
