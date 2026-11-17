"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Food } from "@/lib/nutrition/types";
import { t } from "@/lib/i18n/sr";
import { formatNumber } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

export function FoodPicker({ open, onOpenChange, foods, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; foods: Food[]; onPick: (f: Food) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => { const n = fold(q.trim()); return foods.filter((f) => !f.is_archived && (!n || fold(`${f.name} ${f.brand ?? ""}`).includes(n))).slice(0, 80); }, [foods, q]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t.nutrition.chooseFood} size="lg">
      <div className="grid gap-3">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nutrition.search} className="pl-10" type="search" /></div>
        <ul className="-mx-2 grid max-h-[55vh] overflow-y-auto">
          {list.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{t.foods.empty}</li>}
          {list.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { onPick(f); onOpenChange(false); setQ(""); }} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left hover:bg-hover">
                <div className="min-w-0 flex-1"><div className="font-semibold">{f.name}{f.brand && <span className="font-normal text-muted"> · {f.brand}</span>}</div>
                  <div className="text-xs tabular text-muted">{Math.round(f.kcal_100g)} kcal · P {formatNumber(f.protein_100g)} · UH {formatNumber(f.carbs_100g)} · M {formatNumber(f.fat_100g)} / 100 g</div></div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
