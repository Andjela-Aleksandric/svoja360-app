import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCheckinDeadline } from "./settings";
import { deadlineFor, isPastDeadline, previousWeek } from "@/lib/utils/periods";

export interface NextStep { key: "initial" | "initialContinue" | "diary" | "checkin" | "checkinContinue"; href: string; overdue?: boolean; deadline?: { date: string; hour: number } }

/** What the client should do next, in priority order. */
export async function getClientTasks(clientId: string, startDate: string): Promise<{ steps: NextStep[]; checkin: { status: "missing" | "draft" | "submitted" | "reviewed" | "notDue"; period: { start: string; end: string }; deadline: { date: string; hour: number }; overdue: boolean; id?: string } }> {
  const supabase = await createClient();
  const period = previousWeek();
  const deadlineSetting = await getCheckinDeadline();
  const [{ data: initials }, { data: days }, { data: checkin }] = await Promise.all([
    supabase.from("questionnaire_submissions").select("status").eq("client_id", clientId).eq("kind", "initial"),
    supabase.from("nutrition_diary_days").select("submitted_at").eq("client_id", clientId),
    supabase.from("questionnaire_submissions").select("id, status").eq("client_id", clientId).eq("kind", "checkin").eq("period_start", period.start).maybeSingle(),
  ]);
  const steps: NextStep[] = [];
  const initialDone = (initials ?? []).some((s) => s.status !== "draft");
  const initialDraft = (initials ?? []).some((s) => s.status === "draft");
  if (!initialDone) steps.push({ key: initialDraft ? "initialContinue" : "initial", href: "/klijent/upitnik" });
  const diaryDone = (days ?? []).filter((d) => d.submitted_at).length >= 3;
  if (initialDone && !diaryDone) steps.push({ key: "diary", href: "/klijent/dnevnik-ishrane" });

  const deadline = deadlineFor(period, deadlineSetting);
  const overdue = isPastDeadline(period, deadlineSetting);
  const due = startDate <= period.end;
  const status = !due ? "notDue" : checkin ? (checkin.status as "draft" | "submitted" | "reviewed") : "missing";
  if (status === "missing" || status === "draft") steps.push({ key: status === "draft" ? "checkinContinue" : "checkin", href: "/klijent/izvestaji", overdue, deadline });
  return { steps, checkin: { status, period, deadline, overdue, id: (checkin?.id as string) ?? undefined } };
}
