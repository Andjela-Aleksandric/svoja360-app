"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArrowDown, ArrowUp, BookmarkPlus, CheckCircle2, Copy, CopyPlus, CornerDownRight, LayoutTemplate, MoreHorizontal, Play, Plus, Save, Trash2, X } from "lucide-react";
import type { Food, MealTemplate, NDay, NItem, NMeal, NutritionTree } from "@/lib/nutrition/types";
import { dayMacros, mealMacros } from "@/lib/nutrition/types";
import { macrosFor, kcalFromMacros } from "@/lib/utils/nutrition";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { NumCell } from "@/components/strength/num-cell";
import { deleteProgramAction, setProgramStatusAction } from "@/app/trener/trening/actions";
import { copyNutritionPlanAction, saveMealTemplateAction, saveNutritionPlanAction } from "@/app/trener/ishrana/actions";
import { FoodPicker } from "./food-picker";
import { MacroLine, TargetBars } from "./macro-bar";

const uid = () => crypto.randomUUID();
const statusTone = { draft: "neutral", active: "success", completed: "info", archived: "outline" } as const;

function renumber(x: NutritionTree): NutritionTree {
  return { ...x, days: x.days.map((d, i) => ({ ...d, position: i, meals: d.meals.map((m, j) => ({ ...m, position: j, items: m.items.map((it, k) => ({ ...it, position: k })) })) })) };
}
function cloneMeal(m: NMeal | MealTemplate): NMeal {
  const map = new Map(m.items.map((i) => [i.id, uid()]));
  return { id: uid(), position: 0, name: m.name, meal_time: m.meal_time, instructions: m.instructions, items: m.items.map((i) => ({ ...i, id: map.get(i.id)!, alternative_to: i.alternative_to ? map.get(i.alternative_to) ?? null : null })) };
}

export function NutritionBuilder({ initial, foods, templates, clients, clientName }: { initial: NutritionTree; foods: Food[]; templates: MealTemplate[]; clients: { id: string; full_name: string }[]; clientName: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const [plan, setPlan] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [di, setDi] = useState(0);
  const [picker, setPicker] = useState<{ mealId: string; altOf?: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyClient, setCopyClient] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const day = plan.days[Math.min(di, plan.days.length - 1)];

  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);

  const update = (fn: (x: NutritionTree) => NutritionTree) => { setPlan((c) => renumber(fn(c))); setDirty(true); };
  const updDay = (fn: (d: NDay) => NDay) => update((x) => ({ ...x, days: x.days.map((d) => (d.id === day.id ? fn(d) : d)) }));
  const updMeal = (id: string, fn: (m: NMeal) => NMeal) => updDay((d) => ({ ...d, meals: d.meals.map((m) => (m.id === id ? fn(m) : m)) }));
  const updItem = (mid: string, iid: string, p: Partial<NItem>) => updMeal(mid, (m) => ({ ...m, items: m.items.map((i) => (i.id === iid ? { ...i, ...p } : i)) }));
  const move = <T,>(arr: T[], i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };

  const save = () => startSave(async () => { const r = await saveNutritionPlanAction(plan); if (r.ok) { setDirty(false); toast(t.strength.saved); router.refresh(); } else toast(r.error, "error"); });
  const setStatus = (status: NutritionTree["status"], msg: string) => startBusy(async () => {
    if (dirty) { const r = await saveNutritionPlanAction(plan); if (!r.ok) { toast(r.error, "error"); return; } setDirty(false); }
    const r = await setProgramStatusAction(plan.id, status, "nutrition_plans");
    if (r.ok) { setPlan((x) => ({ ...x, status })); toast(msg); router.refresh(); } else toast(r.error, "error");
  });

  const targets = { kcal: plan.kcal_target, protein: plan.protein_g, carbs: plan.carbs_g, fat: plan.fat_g };
  const macroKcal = plan.protein_g != null && plan.carbs_g != null && plan.fat_g != null ? kcalFromMacros(plan.protein_g, plan.carbs_g, plan.fat_g) : null;

  return (
    <div className="pb-24">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted"><Badge tone={statusTone[plan.status]}>{t.strength.status[plan.status]}</Badge>{clientName ?? t.strength.noClient}</div>
          <input aria-label={t.nutrition.planName} value={plan.name} maxLength={120} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="w-full rounded-[10px] bg-transparent text-[26px] font-extrabold tracking-[-0.02em] outline-none focus:bg-surface sm:text-[30px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.client_id && plan.status !== "active" && <Button variant="accent" onClick={() => setStatus("active", t.strength.activated)} loading={busy}><Play className="size-4" />{t.strength.activate}</Button>}
          <Dropdown>
            <DropdownTrigger asChild><Button variant="secondary" size="icon" aria-label={t.common.actions}><MoreHorizontal className="size-4" /></Button></DropdownTrigger>
            <DropdownContent>
              {plan.status === "active" && <DropdownItem onSelect={() => setStatus("completed", t.common.saved)}><CheckCircle2 />{t.strength.complete}</DropdownItem>}
              <DropdownItem onSelect={() => setCopyOpen(true)}><CopyPlus />{t.strength.duplicate}</DropdownItem>
              {plan.status !== "archived" ? <DropdownItem onSelect={() => setStatus("archived", t.common.saved)}><Archive />{t.common.archive}</DropdownItem> : <DropdownItem onSelect={() => setStatus("draft", t.common.saved)}><LayoutTemplate />{t.common.restore}</DropdownItem>}
              <DropdownSeparator />
              <DropdownItem danger onSelect={() => setDeleteOpen(true)}><Trash2 />{t.common.delete}</DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      <section className="mb-5 grid gap-4 rounded-[20px] border border-line bg-surface p-4 sm:p-5">
        <div className="text-[15px] font-bold">{t.nutrition.targets}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="grid gap-1 text-[12px] font-semibold text-muted">{t.nutrition.kcal}<NumCell label={t.nutrition.kcal} value={plan.kcal_target} min={800} max={6000} integer onChange={(v) => update((x) => ({ ...x, kcal_target: v }))} className="h-11" /></label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">{t.nutrition.protein} (g)<NumCell label={t.nutrition.protein} value={plan.protein_g} min={0} max={500} integer onChange={(v) => update((x) => ({ ...x, protein_g: v }))} className="h-11" /></label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">{t.nutrition.carbs} (g)<NumCell label={t.nutrition.carbs} value={plan.carbs_g} min={0} max={1000} integer onChange={(v) => update((x) => ({ ...x, carbs_g: v }))} className="h-11" /></label>
          <label className="grid gap-1 text-[12px] font-semibold text-muted">{t.nutrition.fat} (g)<NumCell label={t.nutrition.fat} value={plan.fat_g} min={0} max={400} integer onChange={(v) => update((x) => ({ ...x, fat_g: v }))} className="h-11" /></label>
          <label className="col-span-2 grid gap-1 text-[12px] font-semibold text-muted sm:col-span-1">{t.strength.startDate}<Input type="date" value={plan.start_date ?? ""} onChange={(e) => update((x) => ({ ...x, start_date: e.target.value || null }))} /></label>
        </div>
        {macroKcal != null && <p className={cn("text-[13px]", plan.kcal_target && Math.abs(macroKcal - plan.kcal_target) > 50 ? "text-warning" : "text-muted")}>{t.nutrition.macrosFromTargets(macroKcal)}</p>}
        <Field label={t.nutrition.notesForClient} htmlFor="n_notes" optional><Textarea id="n_notes" rows={2} value={plan.notes ?? ""} maxLength={3000} onChange={(e) => update((x) => ({ ...x, notes: e.target.value || null }))} /></Field>
      </section>

      <div className="no-scrollbar -mx-4 mb-4 flex items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {plan.days.map((d, i) => <button key={d.id} role="tab" aria-selected={i === di} onClick={() => setDi(i)} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-semibold", i === di ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink")}>{d.name}</button>)}
        <button disabled={plan.days.length >= 7} onClick={() => { update((x) => ({ ...x, days: [...x.days, { id: uid(), position: x.days.length, name: `${t.common.day} ${x.days.length + 1}`, notes: null, meals: [] }] })); setDi(plan.days.length); }} aria-label={t.nutrition.addDay} className="grid size-10 shrink-0 place-items-center rounded-full text-muted ring-1 ring-line-strong hover:text-ink"><Plus className="size-4" /></button>
      </div>

      {day && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input aria-label={t.nutrition.dayName} value={day.name} maxLength={80} onChange={(e) => updDay((d) => ({ ...d, name: e.target.value }))} className="h-9 w-56" placeholder={t.nutrition.dayNamePlaceholder} />
            <Button size="sm" variant="secondary" disabled={plan.days.length >= 7} onClick={() => { update((x) => ({ ...x, days: [...x.days, { ...day, id: uid(), name: `${day.name} (2)`, meals: day.meals.map(cloneMeal) }] })); setDi(plan.days.length); }}><Copy className="size-4" />{t.nutrition.copyDay}</Button>
            {plan.days.length > 1 && <Button size="sm" variant="ghost" onClick={() => { update((x) => ({ ...x, days: x.days.filter((d) => d.id !== day.id) })); setDi(Math.max(0, di - 1)); }}><Trash2 className="size-4" />{t.nutrition.removeDay}</Button>}
          </div>
          <div className="mb-4"><TargetBars m={dayMacros(day, foodMap)} targets={targets} /></div>

          <div className="grid gap-3">
            <AnimatePresence initial={false}>
              {day.meals.map((m, mi) => {
                const mains = m.items.filter((i) => !i.alternative_to);
                return (
                  <motion.section key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[22px] border border-line bg-surface">
                    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
                      <input aria-label={t.nutrition.mealName} value={m.name} maxLength={80} onChange={(e) => updMeal(m.id, (x) => ({ ...x, name: e.target.value }))} className="min-w-0 flex-1 rounded-[8px] bg-transparent px-1 py-1 text-[16px] font-bold outline-none focus:bg-subtle" />
                      <Input type="time" aria-label={t.nutrition.mealTime} value={m.meal_time ?? ""} onChange={(e) => updMeal(m.id, (x) => ({ ...x, meal_time: e.target.value || null }))} className="h-10 w-[110px] rounded-[12px] px-3 text-sm" />
                      <Button variant="ghost" size="icon-sm" aria-label={t.nutrition.saveMealTemplate} title={t.nutrition.saveMealTemplate} disabled={!m.items.length}
                        onClick={() => startBusy(async () => { const r = await saveMealTemplateAction(m); if (r.ok) { toast(t.nutrition.templateSaved); router.refresh(); } else toast(r.error, "error"); })}><BookmarkPlus /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t.nutrition.copyMeal} onClick={() => updDay((d) => ({ ...d, meals: [...d.meals.slice(0, mi + 1), cloneMeal(m), ...d.meals.slice(mi + 1)] }))} disabled={day.meals.length >= 10}><Copy /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveUp} disabled={mi === 0} onClick={() => updDay((d) => ({ ...d, meals: move(d.meals, mi, -1) }))}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t.strength.moveDown} disabled={mi === day.meals.length - 1} onClick={() => updDay((d) => ({ ...d, meals: move(d.meals, mi, 1) }))}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={t.nutrition.removeMeal} onClick={() => updDay((d) => ({ ...d, meals: d.meals.filter((x) => x.id !== m.id) }))}><Trash2 /></Button>
                    </div>
                    <div className="grid gap-1.5 p-3 sm:p-4">
                      {mains.map((it) => {
                        const alts = m.items.filter((x) => x.alternative_to === it.id);
                        return (
                          <div key={it.id} className="grid gap-1">
                            <ItemRow item={it} food={foodMap.get(it.food_id)} onQty={(v) => updItem(m.id, it.id, { quantity_g: v })}
                              onRemove={() => updMeal(m.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== it.id && y.alternative_to !== it.id) }))}
                              onAlt={() => setPicker({ mealId: m.id, altOf: it.id })} />
                            {alts.map((a) => (
                              <div key={a.id} className="flex items-center gap-1 pl-4">
                                <CornerDownRight className="size-4 shrink-0 text-faint" /><span className="text-[11px] font-semibold uppercase text-faint">{t.nutrition.orAlternative}</span>
                                <div className="flex-1"><ItemRow item={a} food={foodMap.get(a.food_id)} onQty={(v) => updItem(m.id, a.id, { quantity_g: v })} onRemove={() => updMeal(m.id, (x) => ({ ...x, items: x.items.filter((y) => y.id !== a.id) }))} /></div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {!m.items.length && <p className="px-1 py-1 text-sm text-muted">{t.nutrition.noMeals}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={m.items.length >= 40} onClick={() => setPicker({ mealId: m.id })} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-accent hover:bg-accent-soft"><Plus className="size-3.5" />{t.nutrition.addFood}</button>
                        <span className="flex-1" />
                        <MacroLine m={mealMacros(m, foodMap)} />
                      </div>
                      <input aria-label={t.nutrition.instructions} placeholder={t.nutrition.instructions} value={m.instructions ?? ""} maxLength={2000} onChange={(e) => updMeal(m.id, (x) => ({ ...x, instructions: e.target.value || null }))} className="h-10 rounded-[12px] border border-line px-3 text-sm outline-none focus:border-ink" />
                    </div>
                  </motion.section>
                );
              })}
            </AnimatePresence>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" size="lg" disabled={day.meals.length >= 10} onClick={() => updDay((d) => ({ ...d, meals: [...d.meals, { id: uid(), position: d.meals.length, name: `Obrok ${d.meals.length + 1}`, meal_time: null, instructions: null, items: [] }] }))}><Plus className="size-4" />{t.nutrition.addMeal}</Button>
              <Button variant="secondary" size="lg" onClick={() => setTplOpen(true)}><LayoutTemplate className="size-4" />{t.nutrition.fromTemplate}</Button>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-full bg-ink py-2 pl-5 pr-2 text-white shadow-[var(--shadow-pop)] md:bottom-6 md:left-[calc(248px+1rem)]">
            <span className="flex-1 text-sm font-semibold">{t.strength.unsaved}</span>
            <Button variant="accent" onClick={save} loading={saving}><Save className="size-4" />{t.common.save}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <FoodPicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} foods={foods}
        onPick={(f) => picker && updMeal(picker.mealId, (m) => ({ ...m, items: [...m.items, { id: uid(), food_id: f.id, quantity_g: f.serving_size_g ?? 100, alternative_to: picker.altOf ?? null, position: m.items.length, notes: null }] }))} />
      <Modal open={tplOpen} onOpenChange={setTplOpen} title={t.nutrition.mealTemplates}>
        {templates.length === 0 ? <p className="text-sm text-muted">{t.nutrition.noTemplates}</p> : (
          <ul className="-mx-2 grid">
            {templates.map((tp) => (
              <li key={tp.id}><button type="button" onClick={() => { updDay((d) => ({ ...d, meals: [...d.meals, cloneMeal(tp)] })); setTplOpen(false); }} className="flex w-full items-center justify-between gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-hover">
                <span className="font-semibold">{tp.name}</span><MacroLine m={mealMacros(tp, foodMap)} />
              </button></li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal open={copyOpen} onOpenChange={setCopyOpen} title={t.strength.duplicate} size="sm"
        footer={<><Button variant="secondary" onClick={() => setCopyOpen(false)}>{t.common.cancel}</Button><Button loading={busy} onClick={() => startBusy(async () => { const r = await copyNutritionPlanAction(plan.id, copyClient || null, plan.name); if (r.ok) { setCopyOpen(false); router.push(`/trener/ishrana/${r.data.id}`); } else toast(r.error, "error"); })}>{t.strength.duplicate}</Button></>}>
        <Field label={t.strength.assignTo} htmlFor="nc"><NativeSelect id="nc" value={copyClient} onChange={(e) => setCopyClient(e.target.value)}><option value="">{t.strength.noClient}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</NativeSelect></Field>
      </Modal>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={t.common.delete} description={t.strength.deleteConfirm} confirmLabel={t.common.delete} loading={busy}
        onConfirm={() => startBusy(async () => { const r = await deleteProgramAction(plan.id, "nutrition_plans"); if (r.ok) { setDirty(false); router.replace("/trener/ishrana"); } else toast(r.error, "error"); })} />
    </div>
  );
}

function ItemRow({ item, food, onQty, onRemove, onAlt }: { item: NItem; food: Food | undefined; onQty: (v: number) => void; onRemove: () => void; onAlt?: () => void }) {
  const m = food ? macrosFor(food, item.quantity_g) : null;
  return (
    <div className="flex items-center gap-2 rounded-[12px] bg-subtle/60 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{food?.name ?? "–"}</div>
        {m && <MacroLine m={m} className="text-[11px]" />}
      </div>
      <div className="w-20"><NumCell label={t.nutrition.quantity} value={item.quantity_g} min={1} max={3000} step={1} onChange={(v) => v && onQty(v)} /></div>
      <span className="text-xs text-muted">g</span>
      {onAlt && <Button variant="ghost" size="icon-sm" aria-label={t.nutrition.addAlternative} title={t.nutrition.addAlternative} onClick={onAlt}><CornerDownRight /></Button>}
      <Button variant="ghost" size="icon-sm" aria-label={t.common.remove} onClick={onRemove}><X /></Button>
    </div>
  );
}
