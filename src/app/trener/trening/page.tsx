import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { listPrograms } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ProgramsList } from "@/components/programs/programs-list";

export const metadata = { title: t.strength.programsTitle };

export default async function StrengthProgramsPage() {
  await requireCoach();
  const items = await listPrograms("training_programs");
  return (
    <>
      <PageHeader title={t.strength.programsTitle} description={t.strength.programsSubtitle}
        action={<Link href="/trener/trening/novi" className={buttonVariants()}><Plus className="size-4" />{t.strength.newProgram}</Link>} />
      <ProgramsList items={items} basePath="/trener/trening" />
    </>
  );
}
