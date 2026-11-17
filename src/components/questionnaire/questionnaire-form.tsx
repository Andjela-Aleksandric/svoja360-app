"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import type { Consents } from "@/lib/data/questionnaire";
import { byCode, completion, isEmpty, isVisible, validateSections, type Answers, type Question, type Template, type ValidationError } from "@/lib/questionnaire/logic";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { saveAnswersAction, submitSubmissionAction } from "@/app/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { BasicField } from "./fields";
import { FileUpload, type UploadedFile } from "./file-upload";
import { ConsentGate, ConsentList, consentFor, useConsents } from "./consent";

function errorText(e: ValidationError) {
  if (e.code === "required") return t.validation.required;
  if (e.code === "range") return t.validation.range(e.min ?? 0, e.max ?? 0);
  if (e.code === "email") return t.validation.email;
  if (e.code === "date") return t.validation.date;
  if (e.code === "number") return t.validation.number;
  return t.errors.saveFailed;
}

export function QuestionnaireForm({
  template, submission, consents: initialConsents, files: initialFiles, title, intro, doneHref, withConsentStep, prefilled,
}: {
  template: Template;
  submission: { id: string; status: "draft" | "submitted" | "reviewed"; current_step: number; answers: Answers };
  consents: Consents;
  files: (UploadedFile & { question_id: string | null })[];
  title: string;
  intro?: string;
  doneHref: string;
  withConsentStep?: boolean;
  /** Answers suggested by the app (e.g. name, email); saved with the first step. */
  prefilled?: Answers;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const reduce = useReducedMotion();
  const top = useRef<HTMLDivElement>(null);
  const codes = useMemo(() => byCode(template), [template]);
  const [answers, setAnswers] = useState<Answers>({ ...(prefilled ?? {}), ...submission.answers });
  const [dirty, setDirty] = useState<Set<string>>(() => new Set(Object.keys(prefilled ?? {}).filter((k) => submission.answers[k] === undefined)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, UploadedFile[]>>(() => {
    const m: Record<string, UploadedFile[]> = {};
    for (const f of initialFiles) if (f.question_id) (m[f.question_id] ??= []).push(f);
    return m;
  });
  const { consents, set: setConsent, pending: consentPending } = useConsents(initialConsents);
  const locked = submission.status === "reviewed";

  const sectionSteps = template.sections.length;
  const offset = withConsentStep ? 1 : 0;
  const totalSteps = offset + sectionSteps + 1; // + review
  const [step, setStep] = useState(() => Math.min(Math.max(submission.current_step, 0), totalSteps - 1));
  const [dir, setDir] = useState(1);
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const setValue = (q: Question, v: unknown) => {
    setAnswers((a) => ({ ...a, [q.id]: v }));
    setDirty((d) => new Set(d).add(q.id));
    if (errors[q.id]) setErrors((e) => { const n = { ...e }; delete n[q.id]; return n; });
  };

  const isSectionStep = step >= offset && step < offset + sectionSteps;
  const section = isSectionStep ? template.sections[step - offset] : null;
  const pct = completion(template, answers);

  async function persist(nextStep: number): Promise<boolean> {
    if (locked) return true;
    const payload: Answers = {};
    for (const id of dirty) payload[id] = answers[id];
    const res = await saveAnswersAction(submission.id, payload, nextStep);
    if (!res.ok) {
      if (res.fieldErrors) setErrors((e) => ({ ...e, ...res.fieldErrors }));
      toast(res.error, "error");
      return false;
    }
    setDirty(new Set());
    return true;
  }

  function go(next: number, validate: boolean) {
    if (validate && section) {
      const errs = validateSections([section], answers, codes);
      if (Object.keys(errs).length) {
        setErrors(Object.fromEntries(Object.entries(errs).map(([k, e]) => [k, errorText(e)])));
        const first = document.getElementById(`field-${Object.keys(errs)[0]}`);
        first?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        return;
      }
    }
    startSave(async () => {
      if (!(await persist(next))) return;
      setDir(next > step ? 1 : -1);
      setStep(next);
      setErrors({});
      top.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }

  function saveAndExit() {
    startSave(async () => {
      if (await persist(step)) { toast(t.questionnaire.draftSaved); router.push(doneHref); router.refresh(); }
    });
  }

  function submit() {
    startSubmit(async () => {
      if (!(await persist(step))) return;
      const res = await submitSubmissionAction(submission.id);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast(res.error, "error");
        return;
      }
      toast(t.questionnaire.submitted);
      router.push(doneHref);
      router.refresh();
    });
  }

  const missingBySection = template.sections.map((s) => Object.keys(validateSections([s], answers, codes)).length);

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-20">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]">{title}</h1>
        {intro && step === 0 && <p className="mt-2 text-[15px] leading-relaxed text-muted">{intro}</p>}
        <div className="mt-5 flex items-center justify-between text-[13px] font-semibold text-muted">
          <span>{t.questionnaire.step(step + 1, totalSteps)}</span>
          <span className="tabular">{t.questionnaire.completion(pct)}</span>
        </div>
        <ProgressBar value={step + 1} max={totalSteps} className="mt-2" tone="accent" label={t.questionnaire.step(step + 1, totalSteps)} />
      </div>

      {locked && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-sm font-medium text-success"><Lock className="size-4" />{t.questionnaire.status.reviewed}</div>
      )}

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={reduce ? false : { opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          className="rounded-[24px] border border-line bg-surface p-5 sm:p-7"
        >
          {withConsentStep && step === 0 && (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent"><ShieldCheck className="size-5" /></span>
                <h2 className="text-lg font-bold tracking-tight">{t.consent.title}</h2>
              </div>
              <p className="text-[14.5px] leading-relaxed text-muted">{t.consent.intro}</p>
              <ConsentList consents={consents} onChange={setConsent} />
            </div>
          )}

          {section && (
            <div className="grid gap-7">
              <div>
                <h2 className="text-lg font-bold tracking-tight">{section.title}</h2>
                {section.description && <p className="mt-1 text-sm text-muted">{section.description}</p>}
              </div>
              {section.questions.filter((q) => isVisible(q, answers, codes)).map((q) => {
                const need = consentFor(q);
                const blocked = need && !consents[need];
                return (
                  <motion.div key={q.id} id={`field-${q.id}`} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid scroll-mt-24 gap-2.5">
                    <label htmlFor={`q-${q.id}`} id={`q-${q.id}-label`} className="text-[15px] font-semibold leading-snug text-ink">
                      {q.label}
                      {!q.required && <span className="ml-1.5 text-[13px] font-normal text-faint">({t.common.optional})</span>}
                      {q.sensitive && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 align-middle text-[11px] font-semibold text-muted"><Lock className="size-3" />{t.questionnaire.sensitive}</span>}
                    </label>
                    {q.help_text && <p className="-mt-1 text-[13px] leading-snug text-muted">{q.help_text}</p>}
                    {blocked ? (
                      <ConsentGate type={need} pending={consentPending} onGrant={() => setConsent(need, true)} />
                    ) : q.type === "file" ? (
                      <FileUpload
                        kind={(q.options?.kind ?? "document") as never}
                        accept={q.options?.accept}
                        multiple={q.options?.multiple !== false}
                        angles={q.options?.angles}
                        files={files[q.id] ?? []}
                        disabled={locked}
                        context={{ submissionId: submission.id, questionId: q.id }}
                        onChange={(list) => { setFiles((f) => ({ ...f, [q.id]: list })); setValue(q, list.map((x) => x.id)); }}
                      />
                    ) : (
                      <fieldset disabled={locked} className="contents">
                        <BasicField q={q} value={answers[q.id]} onChange={(v) => setValue(q, v)} invalid={!!errors[q.id]} />
                      </fieldset>
                    )}
                    {errors[q.id] && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-danger"><AlertCircle className="size-3.5" />{errors[q.id]}</p>}
                  </motion.div>
                );
              })}
            </div>
          )}

          {step === totalSteps - 1 && (
            <div className="grid gap-4">
              <h2 className="text-lg font-bold tracking-tight">{t.questionnaire.reviewTitle}</h2>
              <ul className="grid gap-2">
                {template.sections.map((s, i) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => go(offset + i, false)} className="flex w-full items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-left hover:border-line-strong">
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", missingBySection[i] ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                        {missingBySection[i] ? missingBySection[i] : <Check className="size-4" />}
                      </span>
                      <span className="flex-1 font-semibold">{s.title}</span>
                      <span className="text-[13px] text-muted">{missingBySection[i] ? t.questionnaire.missingCount(missingBySection[i]) : t.questionnaire.sectionDone}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {Object.keys(errors).length > 0 && <p role="alert" className="text-sm font-medium text-danger">{t.questionnaire.missingCount(missingBySection.reduce((a, b) => a + b, 0))}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 mt-5 flex items-center gap-2 rounded-[20px] bg-bg/90 py-2 backdrop-blur md:bottom-4">
        {step > 0 && <Button type="button" variant="secondary" onClick={() => go(step - 1, false)} disabled={saving || submitting} aria-label={t.common.back}><ArrowLeft className="size-4" /><span className="hidden sm:inline">{t.common.back}</span></Button>}
        {!locked && step < totalSteps - 1 && <Button type="button" variant="ghost" onClick={saveAndExit} disabled={saving || submitting} className="hidden sm:inline-flex">{t.questionnaire.saveDraft}</Button>}
        <div className="flex-1" />
        {step < totalSteps - 1 ? (
          <Button type="button" onClick={() => go(step + 1, true)} loading={saving}>{t.questionnaire.saveAndContinue}<ArrowRight className="size-4" /></Button>
        ) : locked ? (
          <Button type="button" onClick={() => router.push(doneHref)}>{t.common.close}</Button>
        ) : (
          <Button type="button" variant="accent" onClick={submit} loading={submitting} disabled={missingBySection.some(Boolean)}>
            {submission.status === "draft" ? t.questionnaire.submit : t.questionnaire.saveChanges}
          </Button>
        )}
      </div>
      {!locked && step < totalSteps - 1 && <button type="button" onClick={saveAndExit} className="mx-auto mt-1 block text-sm font-semibold text-muted sm:hidden">{t.questionnaire.saveDraft}</button>}
    </div>
  );
}

export { isEmpty };
