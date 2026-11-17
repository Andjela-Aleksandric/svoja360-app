// Device-side queue for workouts saved without a connection. Small and synchronous on purpose:
// localStorage survives app restarts, and a workout payload is a few kilobytes.
import type { WorkoutPayload } from "@/app/actions/workouts";

const KEY = "svoja360:workout-queue:v1";
const DRAFT = (dayId: string) => `svoja360:workout-draft:v1:${dayId}`;

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function queued(): WorkoutPayload[] { return read<WorkoutPayload[]>(KEY, []); }
export function enqueue(p: WorkoutPayload) {
  const list = queued().filter((x) => x.id !== p.id);
  write(KEY, [...list, p]);
  window.dispatchEvent(new Event("svoja360:queue"));
}
export function dequeue(id: string) {
  write(KEY, queued().filter((x) => x.id !== id));
  window.dispatchEvent(new Event("svoja360:queue"));
}

export function loadDraft<T>(dayId: string): T | null { return read<T | null>(DRAFT(dayId), null); }
export function saveDraft(dayId: string, draft: unknown) { write(DRAFT(dayId), draft); }
export function clearDraft(dayId: string) { try { localStorage.removeItem(DRAFT(dayId)); } catch { /* ignore */ } }
