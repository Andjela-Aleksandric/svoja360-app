"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import type { Food } from "@/lib/nutrition/types";
import { t } from "@/lib/i18n/sr";
import { formatNumber } from "@/lib/utils/format";
import { kcalFromMacros } from "@/lib/utils/nutrition";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { NumCell } from "@/components/strength/num-cell";
import { archiveFoodAction, saveFoodAction } from "./actions";

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");

export function FoodLibrary({ foods }: { foods: Food[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [archived, setArchived] = useState(false);
  const [edit, setEdit] = useState<Food | "new" | null>(null);
  const [, start] = useTransition();
  const list = useMemo(() => { const n = fold(q.trim()); return foods.filter((f) => f.is_archived === archived && (!n || fold(`${f.name} ${f.brand ?? ""}`).includes(n))); }, [foods, q, archived]);
  return (
    <>
      <PageHeader title={t.foods.title} description={t.foods.subtitle} action={<Button onClick={() => setEdit("new")}><Plus className="size-4" />{t.foods.add}</Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.foods.searchPlaceholder} className="pl-10" type="search" /></div>
        <Button variant={archived ? "primary" : "secondary"} onClick={() => setArchived(!archived)}><Archive className="size-4" />{t.clients.filters.archived}</Button>
      </div>
      {list.length === 0 ? <EmptyState icon={<Search />} title={t.foods.empty} /> : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-3 font-semibold">{t.foods.name}</th><th className="px-2 py-3 text-right font-semibold">kcal</th><th className="px-2 py-3 text-right font-semibold">{t.nutrition.protein}</th>
                <th className="px-2 py-3 text-right font-semibold">{t.nutrition.carbs}</th><th className="px-2 py-3 text-right font-semibold">{t.nutrition.fat}</th><th className="px-2 py-3 text-right font-semibold">{t.nutrition.fiber}</th><th className="w-24" />
              </tr></thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id} className="border-b border-line/60 last:border-0 hover:bg-hover">
                    <td className="px-5 py-2.5"><div className="font-semibold">{f.name}{f.brand && <span className="font-normal text-muted"> · {f.brand}</span>}</div><div className="text-[11px] text-muted">{f.is_custom ? <Badge tone="outline" className="h-5">{t.foods.custom}</Badge> : f.source}</div></td>
                    <td className="px-2 text-right tabular">{formatNumber(f.kcal_100g, 0)}</td><td className="px-2 text-right tabular">{formatNumber(f.protein_100g)}</td>
                    <td className="px-2 text-right tabular">{formatNumber(f.carbs_100g)}</td><td className="px-2 text-right tabular">{formatNumber(f.fat_100g)}</td><td className="px-2 text-right tabular">{f.fiber_100g != null ? formatNumber(f.fiber_100g) : "–"}</td>
                    <td className="px-2 text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEdit(f)}><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={f.is_archived ? t.common.restore : t.common.archive} onClick={() => start(async () => { const r = await archiveFoodAction(f.id, !f.is_archived); if (r.ok) router.refresh(); else toast(r.error, "error"); })}>{f.is_archived ? <RotateCcw /> : <Archive />}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? t.foods.add : t.common.edit}>
        {edit && <FoodForm food={edit === "new" ? null : edit} onDone={() => { setEdit(null); router.refresh(); }} />}
      </Modal>
    </>
  );
}

function FoodForm({ food, onDone }: { food: Food | null; onDone: () => void }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: food?.name ?? "", brand: food?.brand ?? "", serving_size_g: food?.serving_size_g ?? null, kcal_100g: food?.kcal_100g ?? null, protein_100g: food?.protein_100g ?? null, carbs_100g: food?.carbs_100g ?? null, fat_100g: food?.fat_100g ?? null, fiber_100g: food?.fiber_100g ?? null });
  const est = f.protein_100g != null && f.carbs_100g != null && f.fat_100g != null ? kcalFromMacros(f.protein_100g, f.carbs_100g, f.fat_100g) : null;
  const submit = () => start(async () => {
    const e: Record<string, string> = {};
    for (const k of ["kcal_100g", "protein_100g", "carbs_100g", "fat_100g"] as const) if (f[k] == null) e[k] = t.validation.required;
    setErrors(e); if (Object.keys(e).length) return;
    const r = await saveFoodAction({ id: food?.id, name: f.name, brand: f.brand.trim() || null, serving_size_g: f.serving_size_g, kcal_100g: f.kcal_100g!, protein_100g: f.protein_100g!, carbs_100g: f.carbs_100g!, fat_100g: f.fat_100g!, fiber_100g: f.fiber_100g });
    if (r.ok) { toast(food ? t.common.saved : t.foods.created); onDone(); } else { setErrors(r.fieldErrors ?? {}); toast(r.error, "error"); }
  });
  const num = (k: keyof typeof f, label: string, max: number) => (
    <Field label={label} htmlFor={`f-${k}`} error={errors[k]}><NumCell label={label} value={f[k] as number | null} min={0} max={max} step={0.1} onChange={(v) => setF({ ...f, [k]: v })} className="h-11" /></Field>
  );
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label={t.foods.name} htmlFor="f-name" error={errors.name}><Input id="f-name" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t.foods.brand} htmlFor="f-brand" optional><Input id="f-brand" value={f.brand} maxLength={80} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
      </div>
      <p className="text-[13px] font-semibold text-muted">{t.foods.per100}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {num("kcal_100g", t.nutrition.kcal, 900)}{num("protein_100g", `${t.nutrition.protein} (g)`, 100)}{num("carbs_100g", `${t.nutrition.carbs} (g)`, 100)}
        {num("fat_100g", `${t.nutrition.fat} (g)`, 100)}{num("fiber_100g", `${t.nutrition.fiber} (g)`, 100)}{num("serving_size_g", t.foods.serving, 3000)}
      </div>
      {est != null && <p className="text-[13px] text-muted">{t.nutrition.macrosFromTargets(est)}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button><Button onClick={submit} loading={pending}>{t.common.save}</Button></div>
    </div>
  );
}
