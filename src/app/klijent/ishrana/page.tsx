import Link from "next/link";
import { Apple } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { getActivePlanId, getNutritionTree, listFoods } from "@/lib/data/nutrition";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NutritionPlanView } from "@/components/nutrition/plan-view";

export const metadata = { title: t.nav.client.nutrition };

export default async function ClientNutritionPage() {
  const viewer = await requireClient();
  const id = await getActivePlanId(viewer.client.id);
  const [plan, foods] = await Promise.all([id ? getNutritionTree(id) : null, listFoods(true)]);
  return (
    <>
      <PageHeader title={t.nav.client.nutrition} description={plan?.name} action={<Link href="/klijent/dnevnik-ishrane" className="text-sm font-semibold text-accent">{t.diary.title}</Link>} />
      {plan ? <NutritionPlanView plan={plan} foods={foods} /> : <EmptyState icon={<Apple />} title={t.nutrition.noPlan} />}
    </>
  );
}
