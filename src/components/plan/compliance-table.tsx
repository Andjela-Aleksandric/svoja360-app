import { Check, Minus, X } from "lucide-react";
import type { WeekHistoryRow } from "@/lib/data/client-home";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatDateShort, formatNumber } from "@/lib/utils/format";
import { Meter } from "@/components/ui/hero";

const O = t.profile.overview;

/** Week-by-week plan vs. done for one client (strength, running, check-in, weight). */
export function ComplianceTable({ rows }: { rows: WeekHistoryRow[] }) {
  if (!rows.length) return null;
  const head = [O.colWeek, t.clientHome.legendStrength, t.nav.client.running, O.colCheckin, O.colWeight];
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-line text-left">{head.map((h) => <th key={h} className="eyebrow px-3 pb-2.5 text-[10px] font-normal">{h}</th>)}</tr>
        </thead>
        <tbody className="stagger">
          {rows.map((r, i) => {
            const runByMin = r.targetMin != null;
            const runVal = runByMin ? r.minutes : r.km, runTarget = runByMin ? r.targetMin : r.targetKm;
            const strengthOk = r.strengthPlanned > 0 && r.strengthDone >= r.strengthPlanned;
            return (
              <tr key={r.start} className="transition-colors hover:bg-hover">
                <td className="px-3 py-3 font-semibold tabular">{formatDateShort(r.start)}{i === 0 && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-white">{O.current}</span>}</td>
                <td className="w-[22%] px-3 py-3">
                  {r.strengthPlanned > 0 || r.strengthDone > 0 ? (
                    <><span className="tabular"><b className={cn(strengthOk && "text-mint-ink")}>{r.strengthDone}</b><span className="text-muted">/{r.strengthPlanned || "–"}</span></span>{r.strengthPlanned > 0 && <Meter value={r.strengthDone} max={r.strengthPlanned} className="mt-1.5" />}</>
                  ) : <span className="text-faint">–</span>}
                </td>
                <td className="w-[22%] px-3 py-3">
                  {runVal > 0 || runTarget ? (
                    <><span className="tabular"><b>{runByMin ? runVal : formatNumber(runVal, 1)}</b><span className="text-muted">{runTarget ? ` / ${runByMin ? runTarget : formatNumber(runTarget, 0)}` : ""} {runByMin ? "min" : "km"}</span></span>{runTarget ? <Meter value={runVal} max={runTarget} tone="ink" className="mt-1.5" /> : null}</>
                  ) : <span className="text-faint">–</span>}
                </td>
                <td className="px-3 py-3">
                  {r.checkin === "sent" ? <span className="inline-flex items-center gap-1 font-semibold text-mint-ink"><Check className="size-4" />{O.sent}</span>
                    : r.checkin === "missing" ? <span className="inline-flex items-center gap-1 font-semibold text-accent"><X className="size-4" />{O.missing}</span>
                    : r.checkin === "pending" ? <span className="text-muted">{O.pending}</span>
                    : <Minus className="size-4 text-faint" />}
                </td>
                <td className="px-3 py-3 tabular">{r.weight != null ? <><b>{formatNumber(r.weight, 1)}</b> <span className="text-muted">kg</span></> : <span className="text-faint">–</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
