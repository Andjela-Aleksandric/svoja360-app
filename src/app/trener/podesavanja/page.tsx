import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCheckinDeadline } from "@/lib/data/settings";
import { t } from "@/lib/i18n/sr";
import { formatPhone } from "@/lib/utils/phone";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { DeadlineForm, ProfileForm } from "./forms";

export const metadata = { title: t.settings.title };

export default async function SettingsPage() {
  const viewer = await requireCoach();
  const deadline = await getCheckinDeadline();
  const supabase = await createClient();
  const { data: coaches } = await supabase.from("profiles").select("id, full_name, email, phone").eq("role", "coach").order("full_name");
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader title={t.settings.title} />
      <Card>
        <CardHeader title={t.settings.checkinDeadline} description={t.settings.checkinDeadlineHelp} />
        <CardBody><DeadlineForm weekday={deadline.weekday} hour={deadline.hour} /></CardBody>
      </Card>
      <Card>
        <CardHeader title={t.settings.account} description={t.settings.phoneHelp} />
        <CardBody><ProfileForm fullName={viewer.fullName ?? ""} phone={viewer.phone ?? ""} /></CardBody>
      </Card>
      <Card>
        <CardHeader title={t.settings.coaches} description={t.settings.coachesHelp} />
        <CardBody className="grid gap-2">
          {(coaches ?? []).map((c) => (
            <div key={c.id as string} className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-2.5">
              <Avatar name={(c.full_name as string) || (c.email as string)} size={36} />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{(c.full_name as string) || (c.email as string)}</div><div className="truncate text-xs text-muted">{c.email as string}</div></div>
              <span className="text-sm text-muted tabular">{c.phone ? formatPhone(c.phone as string) : ""}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
