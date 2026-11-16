import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { t } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ClientForm } from "../client-form";

export const metadata = { title: t.clients.newTitle };

export default async function NewClientPage() {
  await requireCoach();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/trener/klijenti" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.clients.title}</Link>
      <PageHeader title={t.clients.newTitle} />
      <Card><CardBody><ClientForm /></CardBody></Card>
    </div>
  );
}
