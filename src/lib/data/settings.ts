import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CheckinDeadline } from "@/lib/utils/periods";

export const DEFAULT_DEADLINE: CheckinDeadline = { weekday: 1, hour: 20 };

export const getCheckinDeadline = cache(async (): Promise<CheckinDeadline> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "checkin_deadline").maybeSingle();
  const v = data?.value as Partial<CheckinDeadline> | undefined;
  const weekday = Number(v?.weekday);
  const hour = Number(v?.hour);
  return {
    weekday: weekday >= 1 && weekday <= 7 ? weekday : DEFAULT_DEADLINE.weekday,
    hour: hour >= 0 && hour <= 23 ? hour : DEFAULT_DEADLINE.hour,
  };
});
