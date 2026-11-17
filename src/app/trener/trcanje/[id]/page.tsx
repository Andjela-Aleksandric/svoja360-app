import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRunningTree } from "@/lib/data/running";
import { t } from "@/lib/i18n/sr";
import { RunningBuilder } from "@/components/running/running-builder";

export default async function RunningProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;
  const tree = await getRunningTree(id);
  if (!tree) notFound();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, full_name").neq("status", "archived").order("full_name");
  const clientName = tree.client_id ? ((clients ?? []).find((c) => c.id === tree.client_id)?.full_name as string) ?? null : null;
  return (
    <>
      <Link href={tree.client_id ? `/trener/klijenti/${tree.client_id}?tab=running` : "/trener/trcanje"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{clientName ?? t.running.programsTitle}</Link>
      <RunningBuilder initial={tree} clients={(clients ?? []) as { id: string; full_name: string }[]} clientName={clientName} />
    </>
  );
}
