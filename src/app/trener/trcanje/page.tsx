import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { listPrograms } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ProgramsList } from "@/components/programs/programs-list";

export const metadata = { title: t.running.programsTitle };

export default async function RunningProgramsPage() {
  await requireCoach();
  const items = await listPrograms("running_programs");
  return (
    <>
      <PageHeader title={t.running.programsTitle} description={t.running.programsSubtitle}
        action={<Link href="/trener/trcanje/novi" className={buttonVariants()}><Plus className="size-4" />{t.running.newProgram}</Link>} />
      <ProgramsList items={items} basePath="/trener/trcanje" />
    </>
  );
}
