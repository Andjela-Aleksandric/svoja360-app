import { requireCoach } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { SIDEBAR_COOKIE } from "@/components/shell/nav-config";

export const dynamic = "force-dynamic";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireCoach();
  const supabase = await createClient();
  const { count } = await supabase
    .from("questionnaire_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  return (
    <AppShell role="coach" collapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "1"} userName={viewer.fullName ?? viewer.email} badges={{ "/trener/izvestaji": count ?? 0 }}>
      {children}
    </AppShell>
  );
}
