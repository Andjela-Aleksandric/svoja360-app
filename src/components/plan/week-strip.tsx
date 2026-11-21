import Link from "next/link";
import { ArrowRight, Check, Dumbbell, Footprints } from "lucide-react";
import type { ClientWeek, WeekItem } from "@/lib/data/client-home";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatNumber, todayISO } from "@/lib/utils/format";

const H = t.clientHome;

/** Monday-Sunday strip with strength days and runs, done ticks, today highlighted. Shared by client home and coach profile. */
export function WeekStrip({ week, hrefFor }: { week: Pick<ClientWeek, "days" | "flexible">; hrefFor?: (it: WeekItem) => string }) {
  const today = todayISO();
  const link = hrefFor ?? ((it: WeekItem) => it.href);
  return (
    <>
            <div className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
              {week.days.map((d, i) => {
                const isToday = d.date === today, past = d.date < today;
                const empty = d.items.length === 0;
                return (
                  <div key={d.date} style={{ animationDelay: `${i * 50}ms` }}
                    className={cn("group/day flex min-h-[188px] w-[150px] shrink-0 snap-start animate-rise flex-col rounded-[20px] border-[1.5px] p-3 transition-all duration-300 lg:w-auto",
                      isToday ? "band border-ink shadow-[0_20px_40px_-24px_rgba(14,12,16,0.9)]" : "border-line bg-surface hover:-translate-y-1 hover:border-line-strong",
                      past && !isToday && "opacity-80")}>
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className={cn("eyebrow text-[10px]", isToday && "text-mint")}>{isToday ? H.today : t.weekdaysShort[i]}</span>
                      <span className={cn("font-display text-[26px] leading-none", isToday ? "text-band-fg" : "text-ink")}>{Number(d.date.slice(8))}</span>
                    </div>
                    <div className="grid flex-1 content-start gap-1.5">
                      {d.items.map((it) => <PlanChip key={it.id} it={it} dark={isToday} href={link(it)} />)}
                      {empty && <span className={cn("mt-auto text-[12.5px]", isToday ? "text-band-muted" : "text-faint")}>{H.rest}</span>}
                    </div>
                    {(d.loggedStrength > 0 || d.loggedKm > 0) && (
                      <div className={cn("mt-2 flex flex-wrap gap-1 border-t pt-2 font-mono text-[10px] uppercase tracking-[0.06em]", isToday ? "border-band-line text-mint" : "border-line text-mint-ink")}>
                        <Check className="size-3" />{H.done}{d.loggedKm > 0 ? ` · ${formatNumber(d.loggedKm, 1)} km` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {week.flexible.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow mb-2 text-[10px]">{H.flexible}</div>
                <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{week.flexible.map((it) => <PlanRow key={it.id} it={it} href={link(it)} />)}</div>
              </div>
            )}
    </>
  );
}

export function WeekLegend() {
  return <div className="hidden gap-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted sm:flex"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-accent" />{t.clientHome.legendStrength}</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-ink" />{t.nav.client.running}</span></div>;
}

function PlanChip({ it, dark, href }: { it: WeekItem; dark?: boolean; href: string }) {
  const Icon = it.kind === "strength" ? Dumbbell : Footprints;
  return (
    <Link href={href} title={it.title}
      className={cn("group/chip flex items-start gap-2 rounded-[12px] px-2 py-1.5 text-left transition-all duration-200 hover:translate-x-0.5",
        dark ? "bg-white/[0.06] hover:bg-white/[0.12]" : it.kind === "strength" ? "bg-accent-soft/70 hover:bg-accent-soft" : "bg-subtle hover:bg-hover")}>
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", it.done ? "bg-mint text-ink" : it.kind === "strength" ? "bg-accent text-white" : dark ? "bg-band-fg text-band" : "bg-ink text-white")}>
        {it.done ? <Check className="size-3" strokeWidth={3} /> : <Icon className="size-3" />}
      </span>
      <span className="min-w-0">
        <span className={cn("line-clamp-2 text-[12.5px] font-semibold leading-tight", it.done && "line-through decoration-mint decoration-2")}>{it.title}</span>
        <span className={cn("block font-mono text-[10px]", dark ? "text-band-muted" : "text-muted")}>{it.sub}</span>
      </span>
    </Link>
  );
}

function PlanRow({ it, href }: { it: WeekItem; href: string }) {
  const Icon = it.kind === "strength" ? Dumbbell : Footprints;
  return (
    <Link href={href} className="group lift blob flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:border-ink">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110", it.done ? "bg-mint text-ink" : it.kind === "strength" ? "bg-accent-soft text-accent" : "bg-subtle text-ink")}>
        {it.done ? <Check className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{it.title}</span><span className="text-xs text-muted">{it.done ? H.done : it.sub}</span></span>
      <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
