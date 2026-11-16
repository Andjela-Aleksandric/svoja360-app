"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import type { MeasurementRow } from "@/lib/data/types";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/trend-chart";
import { deleteMeasurementAction } from "@/app/actions/measurements";
import { MeasurementForm } from "./measurement-form";

type Metric = "weight_kg" | "waist_cm" | "hips_cm" | "chest_cm" | "thigh_cm" | "arm_cm" | "body_fat_pct";
const cols: Metric[] = ["weight_kg", "waist_cm", "hips_cm", "chest_cm", "thigh_cm", "arm_cm", "body_fat_pct"];
const unitOf = (m: Metric) => (m === "weight_kg" ? "kg" : m === "body_fat_pct" ? "%" : "cm");

export function MeasurementsPanel({ clientId, rows, canDelete = true }: { clientId: string; rows: MeasurementRow[]; canDelete?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<MeasurementRow | null>(null);
  const [deleting, setDeleting] = useState<MeasurementRow | null>(null);
  const [pending, start] = useTransition();
  const available = cols.filter((c) => rows.some((r) => r[c] != null));
  const [metric, setMetric] = useState<Metric>(available[0] ?? "weight_kg");
  const series = [...rows].reverse().filter((r) => r[metric] != null).map((r) => ({ date: r.measured_on, value: r[metric] }));
  const first = series[0]?.value ?? null;
  const last = series.at(-1)?.value ?? null;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader
          title={t.measurements.title}
          description={first != null && last != null && series.length > 1 ? `${t.progress.changeSinceStart}: ${last - first > 0 ? "+" : ""}${formatNumber(last - first)} ${unitOf(metric)}` : undefined}
          action={<Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" />{t.measurements.add}</Button>}
        />
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState icon={<Ruler />} title={t.measurements.empty} className="border-0 py-8" />
          ) : (
            <>
              {available.length > 1 && (
                <div className="no-scrollbar mb-4 overflow-x-auto">
                  <Segmented<Metric> size="sm" value={metric} onChange={setMetric} options={available.map((c) => ({ value: c, label: t.measurements[c] }))} />
                </div>
              )}
              {series.length > 1 ? <TrendChart data={series} unit={unitOf(metric)} ariaLabel={t.measurements[metric]} /> : <p className="text-sm text-muted">{t.progress.noData}</p>}
            </>
          )}
        </CardBody>
      </Card>

      {rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">{t.measurements.date}</th>
                  {cols.map((c) => <th key={c} className="px-2 py-3 text-right font-semibold">{t.measurements[c]}</th>)}
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-semibold tabular">{formatDate(r.measured_on)}</div>
                      {r.source !== "manual" && <Badge tone="outline" className="mt-1 h-5 text-[11px]">{t.measurements.source[r.source]}</Badge>}
                    </td>
                    {cols.map((c) => <td key={c} className="px-2 py-2.5 text-right tabular">{r[c] != null ? formatNumber(r[c]) : <span className="text-faint">–</span>}</td>)}
                    <td className="whitespace-nowrap px-3 text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={t.common.edit} onClick={() => setEditing(r)}><Pencil /></Button>
                      {canDelete && <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} onClick={() => setDeleting(r)}><Trash2 /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={adding} onOpenChange={setAdding} title={t.measurements.add}>
        <MeasurementForm clientId={clientId} onDone={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={t.measurements.edit}>
        {editing && <MeasurementForm clientId={clientId} measurement={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t.common.delete}
        description={t.measurements.deleteConfirm}
        confirmLabel={t.common.delete}
        loading={pending}
        onConfirm={() => deleting && start(async () => {
          const res = await deleteMeasurementAction(deleting.id);
          if (res.ok) { toast(t.measurements.deleted); setDeleting(null); router.refresh(); } else toast(res.error, "error");
        })}
      />
    </div>
  );
}
