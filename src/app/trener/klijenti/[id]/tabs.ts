import { t } from "@/lib/i18n/sr";

// Tabs appear here as each module is implemented.
export const profileTabs = [
  { key: "overview", label: t.profile.tabs.overview },
  { key: "initial", label: t.profile.tabs.initial },
  { key: "checkins", label: t.profile.tabs.checkins },
  { key: "measurements", label: t.profile.tabs.measurements },
  { key: "files", label: t.profile.tabs.files },
  { key: "notes", label: t.profile.tabs.notes },
] as const;

export type ProfileTab = (typeof profileTabs)[number]["key"];
