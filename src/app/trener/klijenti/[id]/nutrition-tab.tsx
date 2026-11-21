import { getActivePlanId, getNutritionTree, listFoods } from "@/lib/data/nutrition";
import { getFoodTotals } from "@/lib/data/food-log";
import { addDays, todayISO } from "@/lib/utils/format";
import { FoodWeek } from "@/components/nutrition/food-week";
import { t } from "@/lib/i18n/sr";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NutritionPlanView } from "@/components/nutrition/plan-view";
import { ProgramsCard } from "./strength-tab";

export async function NutritionTab({ clientId }: { clientId: string }) {
  const id = await getActivePlanId(clientId);
  const today = todayISO();
  const [plan, foods, days] = await Promise.all([id ? getNutritionTree(id) : null, listFoods(true), getFoodTotals(clientId, addDays(today, -6), today)]);
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="xl:col-span-2"><CardHeader title={t.foodLog.weekTitle} description={t.foodLog.weekDesc} /><CardBody className="pt-3"><FoodWeek days={days} targets={{ kcal: plan?.kcal_target ?? null, protein: plan?.protein_g ?? null, carbs: plan?.carbs_g ?? null, fat: plan?.fat_g ?? null }} /></CardBody></Card>
      <ProgramsCard clientId={clientId} table="nutrition_plans" basePath="/trener/ishrana" title={t.nutrition.plansTitle} />
      <Card><CardHeader title={plan?.name ?? t.nutrition.plansTitle} /><CardBody>{plan ? <NutritionPlanView plan={plan} foods={foods} /> : <p className="text-sm text-muted">{t.profile.overview.noPrograms}</p>}</CardBody></Card>
    </div>
  );
}
