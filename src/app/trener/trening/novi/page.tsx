import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listPrograms } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { NewProgramForm } from "@/components/programs/new-program-form";
import { createProgramAction } from "../actions";

export const metadata = { title: t.strength.newProgram };

export default async function NewStrengthProgramPage({ searchParams }: { searchParams: Promise<{ klijent?: string }> }) {
  await requireCoach();
  const { klijent } = await searchParams;
  const supabase = await createClient();
  const [{ data: clients }, programs] = await Promise.all([
    supabase.from("clients").select("id, full_name").eq("status", "active").order("full_name"),
    listPrograms("training_programs"),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/trener/trening" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.strength.programsTitle}</Link>
      <PageHeader title={t.strength.newProgram} />
      <Card><CardBody className="pt-5 sm:pt-6">
        <NewProgramForm action={createProgramAction} basePath="/trener/trening" clients={(clients ?? []) as { id: string; full_name: string }[]} defaultClient={klijent}
          templates={programs.filter((p) => p.status !== "archived").map((p) => ({ id: p.id, label: p.client_name ? `${p.name} (${p.client_name})` : p.name }))} withWeeks />
      </CardBody></Card>
    </div>
  );
}
