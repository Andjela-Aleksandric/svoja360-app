import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { listClientsWithSummary } from "@/lib/data/clients";
import { t } from "@/lib/i18n/sr";
import { previousWeek } from "@/lib/utils/periods";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ClientsTable } from "./clients-table";

export const metadata = { title: t.clients.title };

export default async function ClientsPage() {
  await requireCoach();
  const clients = await listClientsWithSummary();
  const period = previousWeek();
  return (
    <>
      <PageHeader
        title={t.clients.title}
        description={t.clients.subtitle}
        action={<Link href="/trener/klijenti/novi" className={buttonVariants({ variant: "primary" })}><Plus className="size-4" />{t.clients.add}</Link>}
      />
      <ClientsTable clients={clients} periodStart={period.start} />
    </>
  );
}
