// Questionnaire engine shared by the client form, the server actions and the coach view.

export type QuestionType =
  | "text" | "long_text" | "number" | "date" | "single_choice" | "multi_choice"
  | "scale" | "yes_no" | "file" | "measurements" | "planned_done";

export interface QuestionOptions {
  min?: number; max?: number; step?: number;
  choices?: string[];
  minLabel?: string; maxLabel?: string;
  format?: "email";
  kind?: string; multiple?: boolean; accept?: string; angles?: ("front" | "side" | "back")[];
  fields?: string[];
}

export interface Condition { code: string; equals?: unknown; not_equals?: unknown }

export interface Question {
  id: string;
  section_id: string;
  position: number;
  code: string;
  label: string;
  help_text: string | null;
  type: QuestionType;
  options: QuestionOptions | null;
  unit: string | null;
  required: boolean;
  sensitive: boolean;
  condition: Condition | null;
}

export interface Section { id: string; position: number; title: string; description: string | null; questions: Question[] }
export interface Template { id: string; kind: "initial" | "checkin"; name: string; sections: Section[] }

/** Answers keyed by question id. */
export type Answers = Record<string, unknown>;

export function byCode(template: Template): Map<string, Question> {
  return new Map(template.sections.flatMap((s) => s.questions).map((q) => [q.code, q]));
}

export function isVisible(q: Question, answers: Answers, codes: Map<string, Question>): boolean {
  if (!q.condition) return true;
  const dep = codes.get(q.condition.code);
  if (!dep) return true;
  if (!isVisible(dep, answers, codes)) return false;
  const v = answers[dep.id];
  if ("equals" in q.condition) return v === q.condition.equals;
  if ("not_equals" in q.condition) return v !== undefined && v !== null && v !== "" && v !== q.condition.not_equals;
  return true;
}

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every((x) => x === null || x === undefined || x === "");
  return false;
}

export type ValidationCode = "required" | "number" | "range" | "email" | "date" | "choice" | "invalid";
export interface ValidationError { code: ValidationCode; min?: number; max?: number }

/** Validates one value. Returns null when it is fine (empty optional values are fine). */
export function validateValue(q: Question, v: unknown): ValidationError | null {
  if (isEmpty(v)) return q.required && q.type !== "file" ? { code: "required" } : null;
  const o = q.options ?? {};
  switch (q.type) {
    case "text":
    case "long_text":
      if (typeof v !== "string") return { code: "invalid" };
      if (o.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return { code: "email" };
      if (v.length > 5000) return { code: "invalid" };
      return null;
    case "number":
    case "scale": {
      if (typeof v !== "number" || !Number.isFinite(v)) return { code: "number" };
      const min = q.type === "scale" ? o.min ?? 1 : o.min;
      const max = q.type === "scale" ? o.max ?? 10 : o.max;
      if ((min !== undefined && v < min) || (max !== undefined && v > max)) return { code: "range", min, max };
      return null;
    }
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : { code: "date" };
    case "single_choice":
      return typeof v === "string" && (!o.choices || o.choices.includes(v)) ? null : { code: "choice" };
    case "multi_choice":
      return Array.isArray(v) && v.every((x) => typeof x === "string" && (!o.choices || o.choices.includes(x))) ? null : { code: "choice" };
    case "yes_no":
      return typeof v === "boolean" ? null : { code: "invalid" };
    case "file":
      return Array.isArray(v) && v.every((x) => typeof x === "string") ? null : { code: "invalid" };
    case "measurements": {
      if (typeof v !== "object" || Array.isArray(v)) return { code: "invalid" };
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (x === null || x === "") continue;
        if (!(o.fields ?? []).includes(k) || typeof x !== "number" || x < 10 || x > 250) return { code: "range", min: 10, max: 250 };
      }
      return null;
    }
    case "planned_done": {
      const p = v as { planned?: unknown; done?: unknown };
      const ok = (x: unknown) => x === null || x === undefined || (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 21);
      if (typeof v !== "object" || !ok(p.planned) || !ok(p.done)) return { code: "range", min: 0, max: 21 };
      if (q.required && (p.planned == null || p.done == null)) return { code: "required" };
      return null;
    }
  }
  return { code: "invalid" };
}

/** Errors for every visible question in the given sections. */
export function validateSections(sections: Section[], answers: Answers, codes: Map<string, Question>): Record<string, ValidationError> {
  const out: Record<string, ValidationError> = {};
  for (const s of sections) for (const q of s.questions) {
    if (!isVisible(q, answers, codes)) continue;
    const e = validateValue(q, answers[q.id]);
    if (e) out[q.id] = e;
  }
  return out;
}

/** Share of visible required questions that are answered, 0–100. */
export function completion(template: Template, answers: Answers): number {
  const codes = byCode(template);
  const req = template.sections.flatMap((s) => s.questions).filter((q) => q.required && q.type !== "file" && isVisible(q, answers, codes));
  if (!req.length) return 100;
  return Math.round((req.filter((q) => !isEmpty(answers[q.id]) && !validateValue(q, answers[q.id])).length / req.length) * 100);
}
