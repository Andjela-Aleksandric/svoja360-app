// Today's plan on the client home. Filled in by the strength, running and nutrition modules.
import { t } from "@/lib/i18n/sr";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export async function ClientToday({ clientId }: { clientId: string }) {
  void clientId;
  return (
    <Card>
      <CardHeader title={t.clientHome.todayTraining} />
      <CardBody><p className="text-sm text-muted">{t.clientHome.noPlanYet}</p></CardBody>
    </Card>
  );
}
