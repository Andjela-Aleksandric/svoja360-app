import { requireClient } from "@/lib/auth";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { SIDEBAR_COOKIE } from "@/components/shell/nav-config";
import { WorkoutSync } from "@/components/pwa/workout-sync";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireClient();
  return (
    <AppShell role="client" collapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "1"} userName={viewer.client.full_name}>
      {children}
      <WorkoutSync />
    </AppShell>
  );
}
