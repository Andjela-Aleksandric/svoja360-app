import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/sr";
import type { ClientStatus, SubmissionStatus } from "@/lib/data/types";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const tone = status === "active" ? "success" : status === "inactive" ? "warning" : "outline";
  return <Badge tone={tone} dot>{t.clients.status[status]}</Badge>;
}

export function CheckinBadge({ status }: { status: SubmissionStatus | "missing" | null }) {
  if (!status || status === "missing") return <Badge tone="danger">{t.clients.checkin.missing}</Badge>;
  if (status === "submitted") return <Badge tone="accent">{t.clients.checkin.submitted}</Badge>;
  if (status === "reviewed") return <Badge tone="success">{t.clients.checkin.reviewed}</Badge>;
  return <Badge tone="neutral">{t.clients.checkin.draft}</Badge>;
}
