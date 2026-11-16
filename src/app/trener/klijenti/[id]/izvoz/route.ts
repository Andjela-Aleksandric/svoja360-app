import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** GDPR data export: everything stored about one client, as JSON. Coaches only. Files are listed, not embedded. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "coach") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const byClient = async (table: string) => (await supabase.from(table).select("*").eq("client_id", id)).data ?? [];
  const byIds = async (table: string, col: string, ids: string[]) =>
    ids.length ? (await supabase.from(table).select("*").in(col, ids)).data ?? [] : [];
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  const [consents, submissions, notes, diaryDays, files, measurements, programs, sessions, runPrograms, activities, plans] = await Promise.all(
    ["client_consents", "questionnaire_submissions", "coach_notes", "nutrition_diary_days", "client_files", "body_measurements", "training_programs", "workout_sessions", "running_programs", "running_activities", "nutrition_plans"].map(byClient),
  );
  const [answers, diaryItems, tWeeks, tDays, prescriptions, pSets, wSets, rWeeks, rWorkouts, rSegments, nDays, meals, mealItems] = await Promise.all([
    byIds("questionnaire_answers", "submission_id", ids(submissions)),
    byIds("nutrition_diary_items", "day_id", ids(diaryDays)),
    byIds("training_weeks", "program_id", ids(programs)),
    byIds("training_days", "program_id", ids(programs)),
    byIds("exercise_prescriptions", "program_id", ids(programs)),
    byIds("prescription_sets", "program_id", ids(programs)),
    byIds("workout_sets", "session_id", ids(sessions)),
    byIds("running_weeks", "program_id", ids(runPrograms)),
    byIds("running_workouts", "program_id", ids(runPrograms)),
    byIds("running_segments", "program_id", ids(runPrograms)),
    byIds("nutrition_plan_days", "plan_id", ids(plans)),
    byIds("meals", "plan_id", ids(plans)),
    byIds("meal_items", "plan_id", ids(plans)),
  ]);

  await supabase.rpc("log_coach_event", { p_table: "clients", p_record: id, p_action: "EXPORT" });

  const body = {
    exported_at: new Date().toISOString(),
    exported_by: viewer.email,
    client,
    consents,
    questionnaires: { submissions, answers },
    coach_notes: notes,
    nutrition_diary: { days: diaryDays, items: diaryItems },
    files_metadata: files,
    body_measurements: measurements,
    strength: { programs, weeks: tWeeks, days: tDays, prescriptions, prescription_sets: pSets, sessions, sets: wSets },
    running: { programs: runPrograms, weeks: rWeeks, workouts: rWorkouts, segments: rSegments, activities },
    nutrition: { plans, days: nDays, meals, meal_items: mealItems },
  };
  const safeName = String(client.full_name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="svoja360-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
