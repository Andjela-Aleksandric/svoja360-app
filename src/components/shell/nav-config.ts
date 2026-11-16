import { t } from "@/lib/i18n/sr";

export type IconName =
  | "dashboard" | "users" | "dumbbell" | "running" | "apple" | "clipboard" | "library" | "carrot" | "settings"
  | "home" | "chart" | "user" | "more";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile bottom bar (max 4 + "Još"). */
  primary?: boolean;
  exact?: boolean;
}

export const coachNav: NavItem[] = [
  { href: "/trener", label: t.nav.coach.dashboard, icon: "dashboard", primary: true, exact: true },
  { href: "/trener/klijenti", label: t.nav.coach.clients, icon: "users", primary: true },
  { href: "/trener/trening", label: t.nav.coach.strength, icon: "dumbbell", primary: true },
  { href: "/trener/trcanje", label: t.nav.coach.running, icon: "running" },
  { href: "/trener/ishrana", label: t.nav.coach.nutrition, icon: "apple" },
  { href: "/trener/izvestaji", label: t.nav.coach.checkins, icon: "clipboard", primary: true },
  { href: "/trener/vezbe", label: t.nav.coach.exercises, icon: "library" },
  { href: "/trener/namirnice", label: t.nav.coach.foods, icon: "carrot" },
  { href: "/trener/podesavanja", label: t.nav.coach.settings, icon: "settings" },
];

export const clientNav: NavItem[] = [
  { href: "/klijent", label: t.nav.client.home, icon: "home", primary: true, exact: true },
  { href: "/klijent/treninzi", label: t.nav.client.workouts, icon: "dumbbell", primary: true },
  { href: "/klijent/trcanje", label: t.nav.client.running, icon: "running", primary: true },
  { href: "/klijent/ishrana", label: t.nav.client.nutrition, icon: "apple", primary: true },
  { href: "/klijent/napredak", label: t.nav.client.progress, icon: "chart" },
  { href: "/klijent/izvestaji", label: t.nav.client.checkins, icon: "clipboard" },
  { href: "/klijent/profil", label: t.nav.client.profile, icon: "user" },
];
