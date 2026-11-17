"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n/sr";
import { logWorkoutAction } from "@/app/actions/workouts";
import { dequeue, queued } from "@/lib/strength/offline-queue";

/** Sends workouts that were saved offline as soon as the device is back online. */
export function WorkoutSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    const list = queued();
    setPending(list.length);
    if (!list.length || !navigator.onLine) return;
    setSyncing(true);
    let sent = 0;
    for (const p of list) {
      try {
        const r = await logWorkoutAction(p);
        if (r.ok) { dequeue(p.id); sent++; }
      } catch { break; }
    }
    setSyncing(false);
    setPending(queued().length);
    if (sent) router.refresh();
  }, [router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    sync();
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    const q = () => setPending(queued().length);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("svoja360:queue", q);
    const iv = setInterval(sync, 60000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("svoja360:queue", q); clearInterval(iv); };
  }, [sync]);

  if (online && !pending) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-[calc(56px+env(safe-area-inset-top))] z-30 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white shadow-[var(--shadow-pop)] md:top-4">
      {!online ? <CloudOff className="size-4" /> : <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />}
      {!online ? t.workout.offline : syncing ? t.workout.syncing : t.workout.pendingSync(pending)}
      {!online && pending > 0 && <span className="text-white/70">· {t.workout.pendingSync(pending)}</span>}
    </div>
  );
}
