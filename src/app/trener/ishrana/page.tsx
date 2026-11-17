import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { listPrograms } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ProgramsList } from "@/components/programs/programs-list";

export const metadata = { title: t.nutrition.plansTitle };

export default async function NutritionPlansPage() {
  await requireCoach();
  const items = await listPrograms("nutrition_plans");
  return (
    <>
      <PageHeader title={t.nutrition.plansTitle} description={t.nutrition.plansSubtitle}
        action={<Link href="/trener/ishrana/novi" className={buttonVariants()}><Plus className="size-4" />{t.nutrition.newPlan}</Link>} />
      <ProgramsList items={items} basePath="/trener/ishrana" showWeeks={false} />
    </>
  );
}
