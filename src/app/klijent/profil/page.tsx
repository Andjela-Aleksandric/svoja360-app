import Link from "next/link";
import { KeyRound, Smartphone } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConsents, listFiles, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { WhatsAppButton } from "@/components/clients/wa-button";
import { FilesGrid } from "@/components/files/files-grid";
import { ConsentSettings } from "./consent-settings";

export const metadata = { title: t.clientProfile.title };

export default async function ClientProfilePage() {
  const viewer = await requireClient();
  const supabase = await createClient();
  const [consents, contacts, files] = await Promise.all([
    getConsents(viewer.client.id),
    supabase.rpc("coach_contacts"),
    listFiles({ clientId: viewer.client.id }),
  ]);
  const signed = await signFiles(files.filter((f) => f.kind !== "meal_photo"));
  const coaches = ((contacts.data ?? []) as { full_name: string | null; phone: string | null }[]).filter((c) => c.full_name || c.phone);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader title={t.clientProfile.title} />
      <Card>
        <CardBody className="flex items-center gap-4 pt-5 sm:pt-6">
          <Avatar name={viewer.client.full_name} size={56} />
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{viewer.client.full_name}</div>
            <div className="truncate text-sm text-muted">{viewer.email}</div>
            <div className="text-xs text-faint">{t.profile.overview.since} {formatDate(viewer.client.start_date)}</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientProfile.contactCoach} description={t.clientProfile.contactHelp} />
        <CardBody className="grid gap-2">
          {coaches.length ? coaches.map((c, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-2.5">
              <Avatar name={c.full_name} size={36} />
              <span className="flex-1 font-semibold">{c.full_name}</span>
              <WhatsAppButton phone={c.phone} />
            </div>
          )) : <p className="text-sm text-muted">{t.common.notSet}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientProfile.consents} description={t.consent.intro} />
        <CardBody><ConsentSettings initial={consents} /></CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientProfile.documents} />
        <CardBody><FilesGrid files={signed} canDelete /></CardBody>
      </Card>

      <Card>
        <CardHeader title={t.clientProfile.account} />
        <CardBody className="grid gap-3 text-sm">
          <Link href="/nova-lozinka" className="flex items-center gap-2.5 font-semibold hover:text-accent"><KeyRound className="size-4 text-muted" />{t.clientProfile.changePassword}</Link>
          <div className="flex gap-2.5 text-muted"><Smartphone className="mt-0.5 size-4 shrink-0" /><div className="grid gap-1"><span className="font-semibold text-ink">{t.clientProfile.installApp}</span><span>{t.clientProfile.installIos}</span><span>{t.clientProfile.installAndroid}</span></div></div>
        </CardBody>
      </Card>
    </div>
  );
}
