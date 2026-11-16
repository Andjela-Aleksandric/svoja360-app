import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireCoach();
  const supabase = await createClient();
  const { count } = await supabase
    .from("questionnaire_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  return (
    <AppShell role="coach" userName={viewer.fullName ?? viewer.email} badges={{ "/trener/izvestaji": count ?? 0 }}>
      {children}
    </AppShell>
  );
}
