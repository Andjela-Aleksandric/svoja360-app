import Link from "next/link";
import { Apple } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getActivePlanId, getNutritionTree, listFoods } from "@/lib/data/nutrition";
import { getFoodDay } from "@/lib/data/food-log";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkTabs } from "@/components/ui/tabs";
import { NutritionPlanView } from "@/components/nutrition/plan-view";
import { FoodDiary, type PlanMeal } from "@/components/nutrition/food-diary";

export const metadata = { title: t.nav.client.nutrition };

export default async function ClientNutritionPage({ searchParams }: { searchParams: Promise<{ tab?: string; datum?: string }> }) {
  const viewer = await requireClient();
  const sp = await searchParams;
  const today = todayISO();
  const date = sp.datum && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) && sp.datum <= today ? sp.datum : today;
  const tab = sp.tab === "plan" ? "plan" : "diary";
  const id = await getActivePlanId(viewer.client.id);
  const [plan, foods, day] = await Promise.all([id ? getNutritionTree(id) : null, listFoods(true), tab === "diary" ? getFoodDay(viewer.client.id, date) : null]);
  const planMeals: PlanMeal[] = (plan?.days ?? []).flatMap((d) => d.meals.map((m) => ({
    id: m.id, day: d.name, name: m.name, items: m.items.filter((i) => !i.alternative_to).map((i) => ({ food_id: i.food_id, quantity_g: Number(i.quantity_g) })),
  }))).filter((m) => m.items.length);

  return (
    <>
      <PageHeader title={t.nav.client.nutrition} description={plan?.name} action={<Link href="/klijent/dnevnik-ishrane" className="text-sm font-semibold text-accent">{t.diary.title}</Link>} />
      <div className="mb-5">
        <LinkTabs layoutId="nutrition-tabs" active={tab} items={[
          { key: "diary", label: t.foodLog.tabDiary, href: "/klijent/ishrana" },
          { key: "plan", label: t.foodLog.tabPlan, href: "/klijent/ishrana?tab=plan" },
        ]} />
      </div>
      {tab === "plan" ? (
        plan ? <NutritionPlanView plan={plan} foods={foods} /> : <EmptyState icon={<Apple />} title={t.nutrition.noPlan} />
      ) : day && !day.ready ? (
        <EmptyState icon={<Apple />} title={t.foodLog.notReady} />
      ) : (
        <FoodDiary date={date} today={today} entries={day!.entries} water={day!.water} recent={day!.recent} foods={foods} planMeals={planMeals}
          targets={{ kcal: plan?.kcal_target ?? null, protein: plan?.protein_g ?? null, carbs: plan?.carbs_g ?? null, fat: plan?.fat_g ?? null }} />
      )}
    </>
  );
}
