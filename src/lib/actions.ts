import { t } from "@/lib/i18n/sr";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string = t.errors.generic, fieldErrors?: Record<string, string>): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors };
}

/** Map Postgres / PostgREST errors to friendly Serbian messages. Details go to the server log. */
export function dbError(err: { code?: string; message?: string } | null | undefined, context: string): { ok: false; error: string } {
  if (err) console.error(`[db] ${context}:`, err.code, err.message);
  if (err?.code === "23505") return { ok: false, error: t.errors.duplicate };
  if (err?.code === "42501") return { ok: false, error: t.errors.forbidden };
  if (err?.code === "23514" || err?.code === "22P02") return { ok: false, error: t.errors.saveFailed };
  return { ok: false, error: t.errors.generic };
}
