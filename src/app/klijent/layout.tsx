import { requireClient } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireClient();
  return (
    <AppShell role="client" userName={viewer.client.full_name}>
      {children}
    </AppShell>
  );
}
