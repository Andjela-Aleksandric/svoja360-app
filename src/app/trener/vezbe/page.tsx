import { requireCoach } from "@/lib/auth";
import { listExercises, listMuscleGroups } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { ExerciseLibrary } from "./library";

export const metadata = { title: t.exercises.title };

export default async function ExercisesPage() {
  await requireCoach();
  const [exercises, muscles] = await Promise.all([listExercises(true), listMuscleGroups()]);
  return <ExerciseLibrary exercises={exercises} muscles={muscles} />;
}
