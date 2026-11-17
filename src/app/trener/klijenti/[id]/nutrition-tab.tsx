import { getActivePlanId, getNutritionTree, listFoods } from "@/lib/data/nutrition";
import { t } from "@/lib/i18n/sr";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NutritionPlanView } from "@/components/nutrition/plan-view";
import { ProgramsCard } from "./strength-tab";

export async function NutritionTab({ clientId }: { clientId: string }) {
  const id = await getActivePlanId(clientId);
  const [plan, foods] = await Promise.all([id ? getNutritionTree(id) : null, listFoods(true)]);
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <ProgramsCard clientId={clientId} table="nutrition_plans" basePath="/trener/ishrana" title={t.nutrition.plansTitle} />
      <Card><CardHeader title={plan?.name ?? t.nutrition.plansTitle} /><CardBody>{plan ? <NutritionPlanView plan={plan} foods={foods} /> : <p className="text-sm text-muted">{t.profile.overview.noPrograms}</p>}</CardBody></Card>
    </div>
  );
}
