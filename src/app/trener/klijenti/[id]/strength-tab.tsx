import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionSets, getStrengthAnalytics, listExercises } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { totalVolume } from "@/lib/utils/training";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StrengthAnalyticsView } from "@/components/strength/strength-analytics";

const tone = { draft: "neutral", active: "success", completed: "info", archived: "outline" } as const;

export async function ProgramsCard({ clientId, table, basePath, title }: { clientId: string; table: "training_programs" | "running_programs" | "nutrition_plans"; basePath: string; title: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("id, name, status, start_date").eq("client_id", clientId).order("updated_at", { ascending: false });
  return (
    <Card>
      <CardHeader title={title} action={<Link href={`${basePath}/novi?klijent=${clientId}`} className={buttonVariants({ size: "sm" })}><Plus className="size-4" />{t.common.add}</Link>} />
      <CardBody>
        {!data?.length ? <p className="text-sm text-muted">{t.profile.overview.noPrograms}</p> : (
          <ul className="-mx-2 grid">
            {data.map((p) => (
              <li key={p.id as string}>
                <Link href={`${basePath}/${p.id}`} className="flex items-center gap-2 rounded-[12px] px-2 py-2.5 hover:bg-hover">
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name as string}</div>{p.start_date && <div className="text-xs text-muted">{t.strength.startDate} {formatDate(p.start_date as string)}</div>}</div>
                  <Badge tone={tone[p.status as keyof typeof tone]}>{t.strength.status[p.status as keyof typeof tone]}</Badge><ChevronRight className="size-4 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export async function StrengthTab({ clientId }: { clientId: string }) {
  const [{ analytics, sessions }, exercises] = await Promise.all([getStrengthAnalytics(clientId), listExercises(true)]);
  const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
  const recent = sessions.slice(0, 8);
  const sets = await getSessionSets(recent.map((s) => s.id));
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <div className="grid content-start gap-4">
        <ProgramsCard clientId={clientId} table="training_programs" basePath="/trener/trening" title={t.strength.programsTitle} />
        <Card>
          <CardHeader title={t.workout.history} />
          <CardBody>
            {!recent.length ? <p className="text-sm text-muted">{t.workout.noHistory}</p> : (
              <ul className="grid gap-2">
                {recent.map((s) => {
                  const ss = sets.filter((x) => x.session_id === s.id);
                  const byEx = [...new Set(ss.map((x) => x.exercise_id))];
                  return (
                    <li key={s.id}>
                      <details className="group rounded-[14px] border border-line px-3.5 py-2.5">
                        <summary className="flex cursor-pointer list-none items-center gap-2">
                          <div className="min-w-0 flex-1"><div className="truncate font-semibold">{s.name}</div><div className="text-xs text-muted">{formatDate(s.performed_on)} · {formatNumber(totalVolume(ss), 0)} kg</div></div>
                          <ChevronRight className="size-4 text-faint transition-transform group-open:rotate-90" />
                        </summary>
                        <ul className="mt-2 grid gap-1 border-t border-line pt-2 text-[13px]">
                          {byEx.map((id) => {
                            const xs = ss.filter((x) => x.exercise_id === id);
                            return <li key={id} className="flex justify-between gap-3"><span className="truncate">{names[id]}</span><span className="shrink-0 tabular text-muted">{xs[0]?.is_skipped ? t.workout.skipped : xs.filter((x) => x.is_completed).map((x) => `${x.reps ?? "–"}×${x.weight_kg != null ? formatNumber(x.weight_kg, 2) : "–"}`).join(", ")}</span></li>;
                          })}
                          {s.notes && <li className="mt-1 rounded-[8px] bg-subtle px-2 py-1.5 text-muted">{s.notes}</li>}
                        </ul>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
      <StrengthAnalyticsView data={analytics} names={names} />
    </div>
  );
}
