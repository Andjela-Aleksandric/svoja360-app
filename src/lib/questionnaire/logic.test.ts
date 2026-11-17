import { describe, expect, it } from "vitest";
import { byCode, completion, isVisible, validateSections, validateValue, type Question, type Template } from "./logic";

const q = (over: Partial<Question>): Question => ({
  id: over.code ?? "x", section_id: "s", position: 1, code: "x", label: "", help_text: null, type: "text",
  options: null, unit: null, required: false, sensitive: false, condition: null, ...over,
});

const tpl: Template = {
  id: "t", kind: "checkin", name: "",
  sections: [{
    id: "s", position: 1, title: "", description: null,
    questions: [
      q({ code: "pain", type: "yes_no", required: true }),
      q({ code: "pain_details", type: "long_text", required: true, condition: { code: "pain", equals: true } }),
      q({ code: "weight", type: "number", required: true, options: { min: 35, max: 250 } }),
      q({ code: "open", type: "single_choice", options: { choices: ["Da", "Ne"] } }),
      q({ code: "budget", type: "single_choice", required: true, options: { choices: ["A"] }, condition: { code: "open", not_equals: "Ne" } }),
    ],
  }],
};

describe("questionnaire logic", () => {
  const codes = byCode(tpl);
  it("shows conditional questions only when the condition holds", () => {
    expect(isVisible(codes.get("pain_details")!, { pain: false }, codes)).toBe(false);
    expect(isVisible(codes.get("pain_details")!, { pain: true }, codes)).toBe(true);
    expect(isVisible(codes.get("budget")!, {}, codes)).toBe(false);
    expect(isVisible(codes.get("budget")!, { open: "Ne" }, codes)).toBe(false);
    expect(isVisible(codes.get("budget")!, { open: "Da" }, codes)).toBe(true);
  });
  it("validates types and ranges", () => {
    expect(validateValue(codes.get("weight")!, 20)?.code).toBe("range");
    expect(validateValue(codes.get("weight")!, 70.5)).toBeNull();
    expect(validateValue(codes.get("weight")!, "70")?.code).toBe("number");
    expect(validateValue(codes.get("open")!, "Možda")?.code).toBe("choice");
    expect(validateValue(q({ type: "text", options: { format: "email" } }), "a@b")?.code).toBe("email");
    expect(validateValue(q({ type: "planned_done", required: true }), { planned: 3, done: null })?.code).toBe("required");
    expect(validateValue(q({ type: "planned_done" }), { planned: 3, done: 2 })).toBeNull();
    expect(validateValue(q({ type: "scale" }), 11)?.code).toBe("range");
  });
  it("ignores hidden required questions", () => {
    const errs = validateSections(tpl.sections, { pain: false, weight: 70 }, codes);
    expect(Object.keys(errs)).toEqual([]);
    const errs2 = validateSections(tpl.sections, { pain: true, weight: 70 }, codes);
    expect(Object.keys(errs2)).toEqual(["pain_details"]);
  });
  it("computes completion over visible required questions", () => {
    expect(completion(tpl, {})).toBe(0);
    expect(completion(tpl, { pain: false, weight: 70 })).toBe(100);
    expect(completion(tpl, { pain: true, weight: 70 })).toBe(67);
  });
});
