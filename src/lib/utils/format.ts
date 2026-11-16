import { t } from "@/lib/i18n/sr";

export const TIME_ZONE = "Europe/Belgrade";

const MONTHS = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"];
const MONTHS_GEN = ["januara", "februara", "marta", "aprila", "maja", "juna", "jula", "avgusta", "septembra", "oktobra", "novembra", "decembra"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];

/** Parse 'YYYY-MM-DD' as a calendar date (no time zone shift). */
export function parseISODate(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** Today's calendar date in Belgrade as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toParts(value: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { ...parseISODate(value), hasTime: false, date: null as Date | null };
  const date = typeof value === "string" ? new Date(value) : value;
  const iso = todayISO(date);
  return { ...parseISODate(iso), hasTime: true, date };
}

/** 9.11.2026. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const p = toParts(value);
  return `${p.d}.${p.m}.${p.y}.`;
}

/** 9.11. (no year) */
export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return "";
  const p = toParts(value);
  return `${p.d}.${p.m}.`;
}

/** 9. novembar 2026. */
export function formatDateLong(value: string | Date | null | undefined, opts: { year?: boolean; genitive?: boolean } = {}): string {
  if (!value) return "";
  const p = toParts(value);
  const month = (opts.genitive ? MONTHS_GEN : MONTHS)[p.m - 1];
  return opts.year === false ? `${p.d}. ${month}` : `${p.d}. ${month} ${p.y}.`;
}

export function monthName(index0: number, short = false): string {
  return (short ? MONTHS_SHORT : MONTHS)[index0];
}

/** ponedeljak, 17. novembra */
export function formatWeekdayDate(value: string | Date): string {
  const p = toParts(value);
  const dow = isoWeekday(`${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`);
  return `${t.weekdays[dow - 1]}, ${p.d}. ${MONTHS_GEN[p.m - 1]}`;
}

/** 1 = Monday ... 7 = Sunday */
export function isoWeekday(isoDate: string): number {
  const { y, m, d } = parseISODate(isoDate);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return `${formatDate(value)} u ${formatTime(value)}`;
}

/** Serbian number formatting: decimal comma, thousands dot. */
export function formatNumber(value: number | null | undefined, maxFractionDigits = 1, minFractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const fixed = Number(value).toFixed(maxFractionDigits);
  let [int, frac = ""] = fixed.split(".");
  const neg = int.startsWith("-");
  if (neg) int = int.slice(1);
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  frac = frac.replace(/0+$/, "");
  while (frac.length < minFractionDigits) frac += "0";
  return `${neg ? "-" : ""}${int}${frac ? "," + frac : ""}`;
}

export function formatWithUnit(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${formatNumber(value, digits)} ${unit}`;
}

/** Accepts "68,4" or "68.4". Returns null for empty or invalid input. */
export function parseDecimal(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function ageFromBirthDate(birthDate: string | null | undefined, today = todayISO()): number | null {
  if (!birthDate) return null;
  const b = parseISODate(birthDate);
  const n = parseISODate(today);
  let age = n.y - b.y;
  if (n.m < b.m || (n.m === b.m && n.d < b.d)) age--;
  return age;
}

export function relativeDays(isoDate: string, today = todayISO()): string {
  const diff = daysBetween(isoDate, today);
  if (diff === 0) return t.common.today;
  if (diff === 1) return t.common.yesterday;
  if (diff === -1) return t.common.tomorrow;
  if (diff > 1) return diff < 5 ? `pre ${diff} dana` : `pre ${diff} dana`;
  return `za ${-diff} dana`;
}

export function addDays(isoDate: string, days: number): string {
  const { y, m, d } = parseISODate(isoDate);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** b - a in whole days */
export function daysBetween(a: string, b: string): number {
  const pa = parseISODate(a), pb = parseISODate(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

export function greeting(now: Date = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(now));
  if (hour < 11) return t.dashboard.greetingMorning;
  if (hour < 18) return t.dashboard.greetingDay;
  return t.dashboard.greetingEvening;
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

export function initials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
