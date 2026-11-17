import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listPrograms } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { NewProgramForm } from "@/components/programs/new-program-form";
import { createNutritionPlanAction } from "../actions";

export const metadata = { title: t.nutrition.newPlan };

export default async function NewNutritionPlanPage({ searchParams }: { searchParams: Promise<{ klijent?: string }> }) {
  await requireCoach();
  const { klijent } = await searchParams;
  const supabase = await createClient();
  const [{ data: clients }, plans] = await Promise.all([supabase.from("clients").select("id, full_name").eq("status", "active").order("full_name"), listPrograms("nutrition_plans")]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/trener/ishrana" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.nutrition.plansTitle}</Link>
      <PageHeader title={t.nutrition.newPlan} />
      <Card><CardBody className="pt-5 sm:pt-6">
        <NewProgramForm action={createNutritionPlanAction} basePath="/trener/ishrana" clients={(clients ?? []) as { id: string; full_name: string }[]} defaultClient={klijent}
          templates={plans.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, label: p.client_name ? `${p.name} (${p.client_name})` : p.name }))} />
      </CardBody></Card>
    </div>
  );
}
