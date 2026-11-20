"use client";
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import type { Food, NutritionTree } from "@/lib/nutrition/types";
import { dayMacros, mealMacros } from "@/lib/nutrition/types";
import { t } from "@/lib/i18n/sr";
import { formatNumber } from "@/lib/utils/format";
import { Segmented } from "@/components/ui/tabs";
import { MacroLine, TargetBars } from "./macro-bar";

export function NutritionPlanView({ plan, foods }: { plan: NutritionTree; foods: Food[] }) {
  const map = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const [dayId, setDayId] = useState(plan.days[0]?.id ?? "");
  const day = plan.days.find((d) => d.id === dayId) ?? plan.days[0];
  if (!day) return <p className="text-sm text-muted">{t.nutrition.noMeals}</p>;
  return (
    <div className="grid gap-4">
      {plan.notes && <p className="whitespace-pre-wrap rounded-[16px] bg-accent-soft/50 px-4 py-3 text-[14.5px] leading-relaxed">{plan.notes}</p>}
      {plan.days.length > 1 && <div className="no-scrollbar overflow-x-auto"><Segmented value={day.id} onChange={setDayId} options={plan.days.map((d) => ({ value: d.id, label: d.name }))} /></div>}
      <TargetBars m={dayMacros(day, map)} targets={{ kcal: plan.kcal_target, protein: plan.protein_g, carbs: plan.carbs_g, fat: plan.fat_g }} />
      <div className="stagger grid gap-3 md:grid-cols-2">
        {day.meals.map((m) => (
          <section key={m.id} className="lift rounded-[22px] border border-line bg-surface p-4 hover:border-line-strong">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-[16px] font-bold">{m.name}</h3>
              {m.meal_time && <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted"><Clock className="size-3.5" />{m.meal_time}</span>}
            </div>
            <ul className="grid gap-1.5">
              {m.items.filter((i) => !i.alternative_to).map((i) => {
                const alts = m.items.filter((a) => a.alternative_to === i.id);
                return (
                  <li key={i.id} className="text-[14.5px]">
                    <div className="flex justify-between gap-3"><span>{map.get(i.food_id)?.name}</span><span className="shrink-0 font-semibold tabular">{formatNumber(i.quantity_g, 0)} g</span></div>
                    {alts.map((a) => <div key={a.id} className="flex justify-between gap-3 pl-3 text-[13px] text-muted"><span><em className="not-italic font-semibold uppercase text-faint">{t.nutrition.orAlternative}</em> {map.get(a.food_id)?.name}</span><span className="tabular">{formatNumber(a.quantity_g, 0)} g</span></div>)}
                  </li>
                );
              })}
            </ul>
            {m.instructions && <p className="mt-2 rounded-[10px] bg-subtle px-3 py-2 text-[13px]">{m.instructions}</p>}
            <div className="mt-2 border-t border-line pt-2"><MacroLine m={mealMacros(m, map)} /></div>
          </section>
        ))}
      </div>
    </div>
  );
}
