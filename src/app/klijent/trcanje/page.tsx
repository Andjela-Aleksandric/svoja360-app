import { requireClient } from "@/lib/auth";
import { getActiveRunningProgramId, getRunningTree, listActivities } from "@/lib/data/running";
import { currentWeekNumber } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/page-header";
import { RunningView } from "@/components/running/running-view";

export const metadata = { title: t.nav.client.running };

export default async function ClientRunningPage() {
  const viewer = await requireClient();
  const id = await getActiveRunningProgramId(viewer.client.id);
  const [tree, activities] = await Promise.all([id ? getRunningTree(id) : null, listActivities(viewer.client.id)]);
  const week = tree ? currentWeekNumber(tree.start_date, todayISO(), tree.weeks.length) : 1;
  return (
    <>
      <PageHeader title={t.nav.client.running} description={tree ? tree.name : t.running.noProgram} />
      <RunningView tree={tree} currentWeek={week} activities={activities} />
    </>
  );
}
