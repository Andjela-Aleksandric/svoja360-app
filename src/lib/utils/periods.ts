import { addDays, isoWeekday, todayISO } from "./format";

export interface CheckinDeadline {
  /** 1 = Monday ... 7 = Sunday */
  weekday: number;
  hour: number;
}

export interface ReportingPeriod {
  start: string; // Monday
  end: string; // Sunday
}

/** Monday of the week containing isoDate. */
export function weekStart(isoDate: string): string {
  return addDays(isoDate, 1 - isoWeekday(isoDate));
}

/** The previous full Monday–Sunday week relative to `today`. */
export function previousWeek(today: string = todayISO()): ReportingPeriod {
  const thisMonday = weekStart(today);
  const start = addDays(thisMonday, -7);
  return { start, end: addDays(start, 6) };
}

/** Deadline (local date + hour) for reporting on the period that ends on `periodEnd`. */
export function deadlineFor(period: ReportingPeriod, deadline: CheckinDeadline): { date: string; hour: number } {
  // The deadline falls in the week after the period: weekday 1 = Monday right after.
  return { date: addDays(period.end, deadline.weekday), hour: deadline.hour };
}

/** Whether `now` (Belgrade local date + hour) is past the deadline. */
export function isPastDeadline(
  period: ReportingPeriod,
  deadline: CheckinDeadline,
  nowDate: string = todayISO(),
  nowHour: number = currentHourBelgrade(),
): boolean {
  const d = deadlineFor(period, deadline);
  if (nowDate > d.date) return true;
  if (nowDate < d.date) return false;
  return nowHour >= d.hour;
}

export function currentHourBelgrade(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", hour12: false }).format(now));
}

/** Last n reporting periods, newest first. */
export function lastPeriods(n: number, today: string = todayISO()): ReportingPeriod[] {
  const out: ReportingPeriod[] = [];
  let p = previousWeek(today);
  for (let i = 0; i < n; i++) {
    out.push(p);
    const start = addDays(p.start, -7);
    p = { start, end: addDays(start, 6) };
  }
  return out;
}
