import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProgramTree, listExercises } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { ProgramBuilder } from "@/components/strength/program-builder";

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;
  const [tree, exercises] = await Promise.all([getProgramTree(id), listExercises(true)]);
  if (!tree) notFound();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("id, full_name").neq("status", "archived").order("full_name");
  const clientName = tree.client_id ? (clients ?? []).find((c) => c.id === tree.client_id)?.full_name ?? null : null;
  return (
    <>
      <Link href={tree.client_id ? `/trener/klijenti/${tree.client_id}?tab=strength` : "/trener/trening"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" />{clientName ?? t.strength.programsTitle}</Link>
      <ProgramBuilder initial={tree} exercises={exercises} clients={(clients ?? []) as { id: string; full_name: string }[]} clientName={clientName as string | null} />
    </>
  );
}
