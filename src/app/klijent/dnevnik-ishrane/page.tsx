import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConsents, listFiles, signFiles } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { DiaryEditor, type DiaryDay } from "./diary-editor";

export const metadata = { title: t.diary.title };

export default async function DiaryPage() {
  const viewer = await requireClient();
  const supabase = await createClient();
  const { data: days } = await supabase.from("nutrition_diary_days").select("id, day_index, diary_date, day_type, notes, submitted_at").eq("client_id", viewer.client.id).order("day_index");
  const ids = (days ?? []).map((d) => d.id as string);
  const [{ data: items }, files, consents] = await Promise.all([
    ids.length ? supabase.from("nutrition_diary_items").select("id, day_id, eaten_at, food_name, quantity, is_drink, notes, created_at").in("day_id", ids).order("eaten_at", { ascending: true, nullsFirst: false }).order("created_at") : Promise.resolve({ data: [] }),
    listFiles({ clientId: viewer.client.id, kinds: ["meal_photo"] }),
    getConsents(viewer.client.id),
  ]);
  const signed = await signFiles(files.filter((f) => f.diary_day_id));
  const byIndex: DiaryDay[] = [1, 2, 3].map((i) => {
    const d = (days ?? []).find((x) => x.day_index === i);
    return {
      index: i,
      id: (d?.id as string) ?? null,
      date: (d?.diary_date as string) ?? "",
      type: (d?.day_type as "weekday" | "weekend" | null) ?? null,
      notes: (d?.notes as string) ?? "",
      done: !!d?.submitted_at,
      items: ((items ?? []) as { id: string; day_id: string; eaten_at: string | null; food_name: string; quantity: string | null; is_drink: boolean; notes: string | null }[]).filter((it) => it.day_id === d?.id),
      photos: signed.filter((f) => f.diary_day_id === d?.id).map((f) => ({ id: f.id, file_name: f.file_name, mime_type: f.mime_type, url: f.url })),
    };
  });
  return <DiaryEditor days={byIndex} photoConsent={consents.photos_videos} />;
}
