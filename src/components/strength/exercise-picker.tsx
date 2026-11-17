"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ExerciseItem } from "@/lib/strength/types";
import { t } from "@/lib/i18n/sr";
import { Modal } from "@/components/ui/modal";
import { Input, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

export function ExercisePicker({ open, onOpenChange, exercises, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; exercises: ExerciseItem[]; onPick: (e: ExerciseItem) => void }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const muscles = useMemo(() => [...new Map(exercises.flatMap((e) => e.muscles).map((m) => [m.id, m.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "sr")), [exercises]);
  const list = useMemo(() => {
    const n = fold(q.trim());
    return exercises.filter((e) => (!n || fold(e.name).includes(n)) && (!muscle || e.muscles.some((m) => String(m.id) === muscle && m.is_primary))).slice(0, 80);
  }, [exercises, q, muscle]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.strength.chooseExercise} size="lg">
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.exercises.searchPlaceholder} className="pl-10" type="search" />
          </div>
          <NativeSelect value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label={t.strength.filterMuscle}>
            <option value="">{t.strength.allMuscles}</option>
            {muscles.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </NativeSelect>
        </div>
        <ul className="-mx-2 grid max-h-[55vh] overflow-y-auto">
          {list.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{t.exercises.empty}</li>}
          {list.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => { onPick(e); onOpenChange(false); setQ(""); }} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{e.name}</div>
                  <div className="truncate text-xs text-muted">{e.muscles.filter((m) => m.is_primary).map((m) => m.name).join(", ")} · {t.exercises.equipmentTypes[e.equipment]}</div>
                </div>
                {e.is_custom && <Badge tone="outline">{t.exercises.custom}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
