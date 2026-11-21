import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExerciseHistory, getPreviousPerformance, getProgramTree, getSessionSets, listExercises } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { WorkoutLogger } from "@/components/strength/workout-logger";

export const metadata = { title: t.workout.today };

export default async function WorkoutDayPage({ params }: { params: Promise<{ dayId: string }> }) {
  const viewer = await requireClient();
  const { dayId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(dayId)) notFound();
  const supabase = await createClient();
  const { data: day } = await supabase.from("training_days").select("id, program_id").eq("id", dayId).maybeSingle();
  if (!day) notFound();
  const tree = await getProgramTree(day.program_id as string);
  const pDay = tree?.weeks.flatMap((w) => w.days).find((d) => d.id === dayId);
  if (!tree || !pDay) notFound();
  const week = tree.weeks.find((w) => w.days.some((d) => d.id === dayId))!;
  // A workout already logged for this day (latest), so it can be reviewed or corrected.
  const { data: existing } = await supabase.from("workout_sessions").select("id, started_at, finished_at, status, notes, performed_on").eq("client_id", viewer.client.id).eq("training_day_id", dayId).order("performed_on", { ascending: false }).limit(1).maybeSingle();
  const existingSets = existing ? await getSessionSets([existing.id as string]) : [];
  const exercises = await listExercises(true);
  const ids = [...new Set([...pDay.exercises.map((e) => e.exercise_id), ...existingSets.map((s) => s.exercise_id)])];
  const [previous, history] = await Promise.all([
    getPreviousPerformance(viewer.client.id, ids, existing?.id as string | undefined),
    getExerciseHistory(viewer.client.id, ids, existing?.id as string | undefined),
  ]);
  return (
    <WorkoutLogger
      programId={tree.id}
      day={pDay}
      weekNumber={week.week_number}
      exercises={exercises.filter((e) => ids.includes(e.id)).map((e) => ({ id: e.id, name: e.name, instructions: e.instructions, media_url: e.media_url, equipment: e.equipment }))}
      previous={previous}
      history={history}
      library={exercises.filter((e) => !e.is_archived)}
      existing={existing ? { id: existing.id as string, started_at: existing.started_at as string | null, finished_at: existing.finished_at as string | null, status: existing.status as string, notes: existing.notes as string | null, performed_on: existing.performed_on as string, sets: existingSets } : null}
    />
  );
}
