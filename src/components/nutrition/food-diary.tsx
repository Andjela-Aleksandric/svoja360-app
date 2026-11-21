"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Copy, Droplet, Plus, Search, Trash2, Zap } from "lucide-react";
import type { Food } from "@/lib/nutrition/types";
import type { FoodEntry, MealSlot } from "@/lib/data/food-log";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { addDays, formatNumber, formatWeekdayDate, isoWeekday } from "@/lib/utils/format";
import { addFoodsAction, copyDayAction, deleteFoodEntryAction, quickAddAction, setWaterAction, updateFoodEntryAction } from "@/app/actions/food-log";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { ProgressRing } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";

const L = t.foodLog;
const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const GLASS = 250;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

export interface PlanMeal { id: string; day: string; name: string; items: { food_id: string; quantity_g: number }[] }
type Targets = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };

export function FoodDiary({ date, today, entries, water, targets, foods, recent, planMeals, basePath = "/klijent/ishrana" }: {
  date: string; today: string; entries: FoodEntry[]; water: number; targets: Targets; foods: Food[]; recent: { food_id: string; grams: number }[]; planMeals: PlanMeal[]; basePath?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [waterMl, setWaterMl] = useState(water);
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const total = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein_g, carbs: a.carbs + e.carbs_g, fat: a.fat + e.fat_g }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const left = targets.kcal ? targets.kcal - total.kcal : null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { if (msg) toast(msg); after?.(); router.refresh(); } else toast(r.error ?? t.errors.generic, "error");
  });

  // Week strip around the selected day (Monday first).
  const monday = addDays(date, -(isoWeekday(date) - 1));
  const label = date === today ? L.today : date === addDays(today, -1) ? L.yesterday : formatWeekdayDate(date);
  const href = (d: string) => (d === today ? basePath : `${basePath}?datum=${d}`);

  return (
    <div className="grid gap-4">
      {/* Date navigation */}
      <div className="flex items-center gap-2">
        <Link href={href(addDays(date, -1))} aria-label={t.common.previous} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface transition-all hover:-translate-x-0.5 hover:border-ink"><ChevronLeft className="size-4" /></Link>
        <div className="no-scrollbar grid flex-1 grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(monday, i), on = d === date, future = d > today;
            return (
              <Link key={d} href={future ? "#" : href(d)} aria-current={on ? "date" : undefined} aria-disabled={future}
                className={cn("grid place-items-center rounded-[14px] py-1.5 transition-all", on ? "bg-ink text-white" : "hover:bg-hover", future && "pointer-events-none opacity-35", d === today && !on && "ring-[1.5px] ring-inset ring-accent")}>
                <span className={cn("font-mono text-[9.5px] uppercase tracking-[0.08em]", on ? "text-mint" : "text-muted")}>{t.weekdaysShort[i]}</span>
                <span className="text-[15px] font-bold tabular">{Number(d.slice(8))}</span>
              </Link>
            );
          })}
        </div>
        <Link href={date >= today ? "#" : href(addDays(date, 1))} aria-label={t.common.next} aria-disabled={date >= today}
          className={cn("grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface transition-all hover:translate-x-0.5 hover:border-ink", date >= today && "pointer-events-none opacity-35")}><ChevronRight className="size-4" /></Link>
      </div>

      {/* Summary */}
      <section className="band relative isolate overflow-hidden rounded-[26px] p-5 sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgba(142,214,184,0.25),transparent)]" />
        <div className="eyebrow eyebrow-line mb-4 text-band-muted">{label}</div>
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center gap-5 sm:justify-start">
            <div className="hidden text-center sm:block"><div className="font-display text-[34px] leading-none tabular">{Math.round(total.kcal)}</div><div className="eyebrow mt-1 text-[9.5px] text-band-muted">{L.eaten}</div></div>
            <ProgressRing value={total.kcal} max={targets.kcal || Math.max(total.kcal, 1)} size={164} stroke={11} tone={left != null && left < 0 ? "accent" : "mint"} track="var(--color-band-line)">
              <div>
                <div className="font-display text-[42px] leading-none tabular">{left != null ? Math.abs(Math.round(left)) : Math.round(total.kcal)}</div>
                <div className="eyebrow mt-1 text-[9.5px] text-band-muted">{left == null ? "kcal" : left >= 0 ? L.left : L.over}</div>
              </div>
            </ProgressRing>
            <div className="hidden text-center sm:block"><div className="font-display text-[34px] leading-none tabular">{targets.kcal ?? "–"}</div><div className="eyebrow mt-1 text-[9.5px] text-band-muted">{L.goal}</div></div>
          </div>
          <div className="grid gap-3.5">
            <div className="flex justify-around text-center sm:hidden">
              <div><div className="font-display text-[26px] leading-none tabular">{Math.round(total.kcal)}</div><div className="eyebrow mt-1 text-[9.5px] text-band-muted">{L.eaten}</div></div>
              <div><div className="font-display text-[26px] leading-none tabular">{targets.kcal ?? "–"}</div><div className="eyebrow mt-1 text-[9.5px] text-band-muted">{L.goal}</div></div>
            </div>
            <MacroBar label={t.nutrition.protein} v={total.protein} target={targets.protein} color="bg-[#ff6b9a]" />
            <MacroBar label={t.nutrition.carbs} v={total.carbs} target={targets.carbs} color="bg-mint" />
            <MacroBar label={t.nutrition.fat} v={total.fat} target={targets.fat} color="bg-[#f5c36b]" />
          </div>
        </div>
      </section>

      {/* Meals */}
      <div className="grid gap-3 md:grid-cols-2">
        {SLOTS.map((slot, si) => {
          const list = entries.filter((e) => e.meal_slot === slot);
          const kcal = list.reduce((a, e) => a + e.kcal, 0);
          return (
            <section key={slot} style={{ animationDelay: `${si * 50}ms` }} className="animate-rise rounded-[22px] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16.5px] font-bold">{L.slots[slot]}</h3>
                  <div className="text-[13px] text-muted tabular">{list.length ? `${Math.round(kcal)} kcal` : L.emptySlot}</div>
                </div>
                <button type="button" onClick={() => setAdding(slot)} aria-label={L.addTo(L.slots[slot])}
                  className="ripple-host grid size-11 place-items-center rounded-full bg-ink text-white transition-all hover:rotate-90 hover:bg-accent hover:shadow-[var(--shadow-glow)] active:scale-90"><Plus className="size-5" /></button>
              </div>
              {list.length > 0 && (
                <ul className="mt-3 grid border-t border-line pt-2">
                  <AnimatePresence initial={false}>
                    {list.map((e) => (
                      <motion.li key={e.id} layout initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}>
                        <button type="button" onClick={() => setEditing(e)} className="row-hover flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-semibold">{e.name}</span>
                            <span className="text-[12px] text-muted tabular">{e.quantity_g != null ? `${formatNumber(e.quantity_g, 0)} g · ` : ""}P {formatNumber(e.protein_g, 0)} · UH {formatNumber(e.carbs_g, 0)} · M {formatNumber(e.fat_g, 0)}</span>
                          </span>
                          <span className="shrink-0 text-[14px] font-bold tabular">{Math.round(e.kcal)}</span>
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Water */}
      <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-4 sm:grid-cols-[140px_1fr] sm:items-center">
        <div className="min-w-[120px]">
          <h3 className="text-[16.5px] font-bold">{L.water}</h3>
          <div className="text-[13px] text-muted tabular">{formatNumber(waterMl / 1000, 2)} l · {L.waterGoal("2")}</div>
        </div>
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: 10 }, (_, i) => {
            const full = waterMl >= (i + 1) * GLASS;
            return (
              <button key={i} type="button" aria-label={`${(i + 1) * GLASS} ml`} aria-pressed={full}
                onClick={() => { const next = full && waterMl < (i + 2) * GLASS ? i * GLASS : (i + 1) * GLASS; setWaterMl(next); run(() => setWaterAction(date, next)); }}
                className={cn("grid h-11 place-items-center rounded-[10px] border-[1.5px] transition-all hover:-translate-y-0.5", full ? "animate-pop border-[#4a90c8] bg-[#dcecf8] text-[#2a6da3]" : "border-line text-faint hover:border-[#4a90c8] hover:text-[#4a90c8]")}>
                <Droplet className={cn("size-4", full && "fill-current")} />
              </button>
            );
          })}
        </div>
      </section>

      {entries.length === 0 && (
        <Button variant="secondary" className="justify-self-start" loading={pending} onClick={() => run(() => copyDayAction(addDays(date, -1), date), L.copied)}><Copy className="size-4" />{L.copyYesterday}</Button>
      )}

      <AddFoodSheet slot={adding} onClose={() => setAdding(null)} foods={foods} foodMap={foodMap} recent={recent} planMeals={planMeals} pending={pending}
        onAdd={(items) => adding && run(() => addFoodsAction({ date, slot: adding, items }), L.added, () => setAdding(null))}
        onQuick={(q) => adding && run(() => quickAddAction({ date, slot: adding, ...q }), L.added, () => setAdding(null))} />

      <EditEntry entry={editing} pending={pending} onClose={() => setEditing(null)}
        onSave={(g) => editing && run(() => updateFoodEntryAction(editing.id, g), t.common.saved, () => setEditing(null))}
        onDelete={() => editing && run(() => deleteFoodEntryAction(editing.id), L.removed, () => setEditing(null))} />
    </div>
  );
}

function MacroBar({ label, v, target, color }: { label: string; v: number; target: number | null; color: string }) {
  const pct = target ? Math.min(100, (v / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]"><span className="font-semibold text-band-muted">{label}</span><span className="tabular"><b>{Math.round(v)}</b><span className="text-band-muted">{target ? ` / ${target}` : ""} g</span></span></div>
      <div className="h-2 overflow-hidden rounded-full bg-band-line"><motion.div className={cn("h-full rounded-full", color)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} /></div>
    </div>
  );
}

function AddFoodSheet({ slot, onClose, foods, foodMap, recent, planMeals, onAdd, onQuick, pending }: {
  slot: MealSlot | null; onClose: () => void; foods: Food[]; foodMap: Map<string, Food>; recent: { food_id: string; grams: number }[]; planMeals: PlanMeal[];
  onAdd: (items: { food_id: string; quantity_g: number }[]) => void; onQuick: (q: { name: string; kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) => void; pending: boolean;
}) {
  const [tab, setTab] = useState<"recent" | "plan" | "all" | "quick">(recent.length ? "recent" : planMeals.length ? "plan" : "all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ food: Food; grams: string } | null>(null);
  const [quick, setQuick] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const results = useMemo(() => {
    const n = fold(q.trim());
    if (!n) return [];
    return foods.filter((f) => !f.is_archived && fold(`${f.name} ${f.brand ?? ""}`).includes(n)).slice(0, 60);
  }, [foods, q]);
  const showSearch = q.trim().length > 0;
  const reset = () => { setQ(""); setPicked(null); setQuick({ name: "", kcal: "", p: "", c: "", f: "" }); };
  useEffect(() => { if (slot) reset(); }, [slot]); // eslint-disable-line react-hooks/exhaustive-deps
  const g = picked ? Number(picked.grams.replace(",", ".")) : 0;
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const row = (f: Food, grams?: number) => (
    <button key={f.id} type="button" onClick={() => setPicked({ food: f, grams: String(grams ?? f.serving_size_g ?? 100) })}
      className="row-hover flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left">
      <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold">{f.name}{f.brand ? <span className="font-normal text-muted"> · {f.brand}</span> : null}</span>
        <span className="text-[12px] text-muted tabular">{Math.round(f.kcal_100g)} kcal {L.per100} · P {formatNumber(f.protein_100g, 0)} · UH {formatNumber(f.carbs_100g, 0)} · M {formatNumber(f.fat_100g, 0)}</span></span>
      {grams != null && <span className="shrink-0 text-[12px] font-semibold text-muted tabular">{formatNumber(grams, 0)} g</span>}
      <Plus className="size-4 shrink-0 text-accent" />
    </button>
  );

  return (
    <Modal open={!!slot} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }} title={slot ? L.addTo(L.slots[slot]) : ""} size="lg">
      {picked ? (
        <div className="grid gap-4">
          <div>
            <div className="text-[18px] font-bold">{picked.food.name}</div>
            <div className="text-[13px] text-muted">{Math.round(picked.food.kcal_100g)} kcal {L.per100}</div>
          </div>
          <label className="grid gap-1.5 text-[13px] font-semibold">{L.amount} ({L.grams})
            <input autoFocus inputMode="decimal" value={picked.grams} onChange={(e) => setPicked({ ...picked, grams: e.target.value.replace(/[^0-9.,]/g, "") })}
              className="h-14 rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-center font-display text-[30px] tabular outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[...(picked.food.serving_size_g ? [picked.food.serving_size_g] : []), 30, 50, 100, 150, 200, 250].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
              <button key={v} type="button" onClick={() => setPicked({ ...picked, grams: String(v) })} className={cn("h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold tabular transition-colors", g === v ? "border-ink bg-ink text-white" : "border-line hover:border-ink")}>
                {v === picked.food.serving_size_g ? `1 ${L.serving} · ${v} g` : `${v} g`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 rounded-[16px] bg-subtle p-3 text-center">
            {[["kcal", picked.food.kcal_100g], ["P", picked.food.protein_100g], ["UH", picked.food.carbs_100g], ["M", picked.food.fat_100g]].map(([k, v]) => (
              <div key={k as string}><div className="font-display text-[24px] leading-none tabular">{g > 0 ? formatNumber((Number(v) * g) / 100, 0) : "–"}</div><div className="eyebrow mt-1 text-[9.5px]">{k}</div></div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPicked(null)}>{t.common.back}</Button>
            <Button className="flex-1" loading={pending} disabled={!(g >= 1 && g <= 5000)} onClick={() => onAdd([{ food_id: picked.food.id, quantity_g: g }])}><Plus className="size-4" />{L.add}</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search}
              className="h-12 w-full rounded-[14px] border-[1.5px] border-line bg-surface pl-11 pr-4 text-[16px] outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft md:text-[15px]" />
          </div>
          {!showSearch && (
            <div className="no-scrollbar overflow-x-auto"><Segmented size="sm" value={tab} onChange={setTab}
              options={[{ value: "recent", label: L.recent }, { value: "plan", label: L.fromPlan }, { value: "all", label: L.all }, { value: "quick", label: L.quick }]} /></div>
          )}
          <div className="-mx-2 max-h-[52vh] overflow-y-auto px-1">
            {showSearch ? (results.length ? results.map((f) => row(f)) : <p className="px-3 py-6 text-center text-sm text-muted">{L.noResults}</p>)
              : tab === "recent" ? (recent.length ? recent.map((r) => { const f = foodMap.get(r.food_id); return f ? row(f, r.grams) : null; }) : <p className="px-3 py-6 text-center text-sm text-muted">{L.noRecent}</p>)
              : tab === "all" ? foods.filter((f) => !f.is_archived).slice(0, 150).map((f) => row(f))
              : tab === "plan" ? (planMeals.length ? (
                <div className="grid gap-2 px-1">
                  {planMeals.map((m) => {
                    const kcal = m.items.reduce((a, i) => a + ((foodMap.get(i.food_id)?.kcal_100g ?? 0) * i.quantity_g) / 100, 0);
                    return (
                      <div key={m.id} className="rounded-[16px] border border-line p-3">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1"><div className="font-bold">{m.name}</div><div className="text-[12px] text-muted">{m.day} · {Math.round(kcal)} kcal</div></div>
                          <Button size="sm" loading={pending} onClick={() => onAdd(m.items)}><Plus className="size-4" />{L.addMeal}</Button>
                        </div>
                        <ul className="mt-2 grid gap-0.5 border-t border-line pt-2 text-[13px] text-ink-2">
                          {m.items.map((i, k) => <li key={k} className="flex justify-between gap-2"><span className="truncate">{foodMap.get(i.food_id)?.name}</span><span className="shrink-0 tabular text-muted">{formatNumber(i.quantity_g, 0)} g</span></li>)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="px-3 py-6 text-center text-sm text-muted">{L.noPlanMeals}</p>)
              : (
                <form className="grid gap-3 px-1" onSubmit={(e) => { e.preventDefault(); const kcal = num(quick.kcal); if (!quick.name.trim() || kcal == null || !(kcal >= 0)) return; onQuick({ name: quick.name.trim(), kcal, protein_g: num(quick.p), carbs_g: num(quick.c), fat_g: num(quick.f) }); }}>
                  <p className="flex items-center gap-2 text-[13px] text-muted"><Zap className="size-4 text-accent" />{L.quickHelp}</p>
                  <input value={quick.name} maxLength={120} onChange={(e) => setQuick({ ...quick, name: e.target.value })} placeholder={L.name} className="h-12 rounded-[14px] border-[1.5px] border-line px-4 outline-none focus:border-ink" />
                  <div className="grid grid-cols-4 gap-2">
                    {([["kcal", "kcal"], ["p", "P (g)"], ["c", "UH (g)"], ["f", "M (g)"]] as const).map(([k, ph]) => (
                      <input key={k} inputMode="decimal" value={quick[k]} placeholder={ph} onChange={(e) => setQuick({ ...quick, [k]: e.target.value.replace(/[^0-9.,]/g, "") })} className="h-12 min-w-0 rounded-[14px] border-[1.5px] border-line px-2 text-center tabular outline-none focus:border-ink" />
                    ))}
                  </div>
                  <Button type="submit" loading={pending} disabled={!quick.name.trim() || !quick.kcal}><Plus className="size-4" />{L.add}</Button>
                </form>
              )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditEntry({ entry, onClose, onSave, onDelete, pending }: { entry: FoodEntry | null; onClose: () => void; onSave: (g: number) => void; onDelete: () => void; pending: boolean }) {
  const [g, setG] = useState("");
  const current = entry?.quantity_g ?? null;
  return (
    <Modal open={!!entry} onOpenChange={(o) => { if (!o) { onClose(); setG(""); } }} title={entry?.name ?? ""} description={entry ? `${Math.round(entry.kcal)} kcal · P ${formatNumber(entry.protein_g, 0)} · UH ${formatNumber(entry.carbs_g, 0)} · M ${formatNumber(entry.fat_g, 0)}` : undefined} size="sm"
      footer={<>
        <Button variant="danger-ghost" onClick={onDelete} loading={pending}><Trash2 className="size-4" />{t.common.delete}</Button>
        {current != null && <Button onClick={() => { const v = Number((g || String(current)).replace(",", ".")); if (v >= 1 && v <= 5000) onSave(v); }} loading={pending}>{t.common.save}</Button>}
      </>}>
      {current != null && (
        <label className="grid gap-1.5 text-[13px] font-semibold">{L.edit} ({L.grams})
          <input inputMode="decimal" defaultValue={String(current)} onChange={(e) => setG(e.target.value.replace(/[^0-9.,]/g, ""))}
            className="h-14 rounded-[14px] border-[1.5px] border-line px-4 text-center font-display text-[28px] tabular outline-none focus:border-ink focus:ring-4 focus:ring-accent-soft" />
        </label>
      )}
    </Modal>
  );
}
