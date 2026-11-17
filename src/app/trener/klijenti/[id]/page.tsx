import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { getClient, getMeasurements } from "@/lib/data/clients";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NoteRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkTabs } from "@/components/ui/tabs";
import { ClientStatusBadge } from "@/components/clients/status";
import { WhatsAppButton } from "@/components/clients/wa-button";
import { MeasurementsPanel } from "@/components/measurements/measurements-panel";
import { ClientActions } from "./client-actions";
import { NotesPanel } from "./notes-panel";
import { OverviewTab } from "./overview-tab";
import { profileTabs, type ProfileTab } from "./tabs";
import { CheckinsTab, FilesTab, InitialTab } from "./questionnaire-tabs";
import { StrengthTab } from "./strength-tab";
import { RunningTab } from "./running-tab";

export default async function ClientProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; v?: string }> }) {
  await requireCoach();
  const { id } = await params;
  const { tab: rawTab, v } = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();
  const tab: ProfileTab = profileTabs.some((x) => x.key === rawTab) ? (rawTab as ProfileTab) : "overview";

  const admin = createAdminClient();
  let account: "linked" | "invited" | "none" = "none";
  if (client.user_id) {
    account = "linked";
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(client.user_id);
      if (data?.user && !data.user.last_sign_in_at) account = "invited";
    }
  }

  const supabase = await createClient();
  const [notesRes, coachesRes] = await Promise.all([
    supabase.from("coach_notes").select("id, client_id, submission_id, body, is_pinned, created_by, created_at, updated_at").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").eq("role", "coach"),
  ]);
  const notes = (notesRes.data ?? []) as NoteRow[];
  const authors = Object.fromEntries((coachesRes.data ?? []).map((p) => [p.id, (p.full_name as string) || (p.email as string)]));

  return (
    <>
      <Link href="/trener/klijenti" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{t.clients.title}</Link>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={client.full_name} size={60} />
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[28px]">{client.full_name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ClientStatusBadge status={client.status} />
              <Badge tone={account === "linked" ? "success" : account === "invited" ? "info" : "outline"}>{t.clients.account[account]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WhatsAppButton phone={client.phone_e164} />
          <ClientActions client={client} canInvite={!!admin} />
        </div>
      </header>

      <div className="mb-6"><LinkTabs layoutId="profile-tabs" active={tab} items={profileTabs.map((x) => ({ key: x.key, label: x.label, href: `/trener/klijenti/${id}?tab=${x.key}` }))} /></div>

      {tab === "overview" && <OverviewTab client={client} pinned={notes.filter((n) => n.is_pinned)} />}
      {tab === "initial" && <InitialTab clientId={id} version={v} />}
      {tab === "checkins" && <CheckinsTab clientId={id} />}
      {tab === "strength" && <StrengthTab clientId={id} />}
      {tab === "running" && <RunningTab clientId={id} />}
      {tab === "files" && <FilesTab clientId={id} />}
      {tab === "measurements" && <MeasurementsPanel clientId={id} rows={await getMeasurements(id)} />}
      {tab === "notes" && <NotesPanel clientId={id} notes={notes} authors={authors} />}
    </>
  );
}
