import { getActiveRunningProgramId, getRunningTree, listActivities } from "@/lib/data/running";
import { currentWeekNumber } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { todayISO } from "@/lib/utils/format";
import { RunningView } from "@/components/running/running-view";
import { ProgramsCard } from "./strength-tab";

export async function RunningTab({ clientId }: { clientId: string }) {
  const id = await getActiveRunningProgramId(clientId);
  const [tree, activities] = await Promise.all([id ? getRunningTree(id) : null, listActivities(clientId)]);
  const week = tree ? currentWeekNumber(tree.start_date, todayISO(), tree.weeks.length) : 1;
  return (
    <div className="grid gap-4">
      <ProgramsCard clientId={clientId} table="running_programs" basePath="/trener/trcanje" title={t.running.programsTitle} />
      <RunningView tree={tree} currentWeek={week} activities={activities} clientId={clientId} />
    </div>
  );
}
