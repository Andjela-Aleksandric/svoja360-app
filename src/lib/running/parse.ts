// Reads GPX and FIT activity files in the browser. Nothing leaves the device until the
// client confirms, and the original file is then stored privately next to the activity.
import { haversineM } from "@/lib/utils/running";

export interface ParsedActivity {
  performed_on: string;
  started_at: string | null;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  elevation_gain_m: number | null;
  title: string | null;
}

function localDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function parseGpx(xml: string): ParsedActivity {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("invalid_gpx");
  const pts = Array.from(doc.getElementsByTagNameNS("*", "trkpt"));
  if (pts.length < 2) throw new Error("empty_gpx");
  let dist = 0, gain = 0, hrSum = 0, hrN = 0, maxHr = 0, pwSum = 0, pwN = 0;
  let prev: { lat: number; lon: number; ele: number | null } | null = null;
  let first: string | null = null, last: string | null = null;
  for (const p of pts) {
    const lat = Number(p.getAttribute("lat")), lon = Number(p.getAttribute("lon"));
    const eleText = p.getElementsByTagNameNS("*", "ele")[0]?.textContent;
    const ele = eleText != null ? Number(eleText) : null;
    const time = p.getElementsByTagNameNS("*", "time")[0]?.textContent ?? null;
    if (time) { first ??= time; last = time; }
    const hr = Number(p.getElementsByTagNameNS("*", "hr")[0]?.textContent ?? NaN);
    if (Number.isFinite(hr) && hr > 0) { hrSum += hr; hrN++; maxHr = Math.max(maxHr, hr); }
    const pw = Number(p.getElementsByTagNameNS("*", "power")[0]?.textContent ?? NaN);
    if (Number.isFinite(pw) && pw > 0) { pwSum += pw; pwN++; }
    if (prev && Number.isFinite(lat) && Number.isFinite(lon)) {
      dist += haversineM(prev.lat, prev.lon, lat, lon);
      if (ele != null && prev.ele != null && ele - prev.ele > 0) gain += ele - prev.ele;
    }
    if (Number.isFinite(lat) && Number.isFinite(lon)) prev = { lat, lon, ele };
  }
  if (!first || !last) throw new Error("no_time");
  const duration = Math.round((Date.parse(last) - Date.parse(first)) / 1000);
  const name = doc.getElementsByTagNameNS("*", "name")[0]?.textContent?.trim() || null;
  return {
    performed_on: localDate(first), started_at: new Date(first).toISOString(), distance_m: Math.round(dist), duration_s: duration,
    avg_hr: hrN ? Math.round(hrSum / hrN) : null, max_hr: hrN ? maxHr : null, avg_power: pwN ? Math.round(pwSum / pwN) : null,
    elevation_gain_m: Math.round(gain) || null, title: name,
  };
}

export async function parseFit(buf: ArrayBuffer): Promise<ParsedActivity> {
  const { default: FitParser } = await import("fit-file-parser");
  const fit = await new FitParser({ force: true, speedUnit: "m/s", lengthUnit: "m", mode: "list" }).parseAsync(buf);
  const s = (fit.sessions as Record<string, unknown>[] | undefined)?.[0];
  if (!s) throw new Error("no_session");
  const start = s.start_time ? new Date(s.start_time as string | Date).toISOString() : null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    performed_on: start ? localDate(start) : new Date().toISOString().slice(0, 10),
    started_at: start,
    distance_m: Math.round(n(s.total_distance) ?? 0),
    duration_s: Math.round(n(s.total_timer_time) ?? n(s.total_elapsed_time) ?? 0),
    avg_hr: n(s.avg_heart_rate) != null ? Math.round(n(s.avg_heart_rate)!) : null,
    max_hr: n(s.max_heart_rate) != null ? Math.round(n(s.max_heart_rate)!) : null,
    avg_power: n(s.avg_power) != null ? Math.round(n(s.avg_power)!) : null,
    elevation_gain_m: n(s.total_ascent) != null ? Math.round(n(s.total_ascent)!) : null,
    title: null,
  };
}
