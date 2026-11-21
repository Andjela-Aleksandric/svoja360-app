import Link from "next/link";
import { Apple, ArrowRight, Check, Dumbbell, Footprints, Moon } from "lucide-react";
import type { ClientWeek, WeekItem } from "@/lib/data/client-home";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatWeekdayDate } from "@/lib/utils/format";

const H = t.clientHome;

/** "Danas": what to do today, one tap to start it. */
export function TodayPanel({ week }: { week: ClientWeek }) {
  const items = week.today;
  const n = week.nutrition;
  return (
    <section aria-label={H.today} className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-bold tracking-[-0.01em]">{H.todayTitle}</h2>
        <span className="eyebrow text-[10px]">{formatWeekdayDate(new Date())}</span>
      </div>
      <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 && (
          <div className="flex items-center gap-4 rounded-[22px] border border-dashed border-line-strong bg-surface p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint-soft text-mint-ink"><Moon className="size-5" /></span>
            <div><div className="font-bold">{H.restDay}</div><div className="text-sm text-muted">{H.restHint}</div></div>
          </div>
        )}
        {items.map((it) => <TodayCard key={it.id} it={it} />)}
        {n && (
          <Link href="/klijent/ishrana" className="group lift blob blob-mint flex items-center gap-4 rounded-[22px] border border-line bg-surface p-5 hover:border-ink">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint-soft text-mint-ink transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110"><Apple className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="eyebrow text-[10px]">{H.todayNutrition}</div>
              <div className="mt-0.5 font-bold">{n.kcal ? `${n.kcal} kcal` : n.name}</div>
              <div className="text-sm text-muted">{[n.protein && `P ${n.protein} g`, n.carbs && `UH ${n.carbs} g`, n.fat && `M ${n.fat} g`].filter(Boolean).join(" · ") || H.openPlan}</div>
            </div>
            <ArrowRight className="size-4 text-faint transition-transform group-hover:translate-x-1 group-hover:text-ink" />
          </Link>
        )}
      </div>
    </section>
  );
}

function TodayCard({ it }: { it: WeekItem }) {
  const strength = it.kind === "strength";
  const Icon = strength ? Dumbbell : Footprints;
  return (
    <Link href={it.href}
      className={cn("group lift ripple-host flex items-center gap-4 rounded-[22px] border-[1.5px] p-5",
        it.done ? "border-mint bg-mint-soft/50 hover:border-mint-ink" : strength ? "band border-ink" : "border-ink bg-surface hover:border-accent")}>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110",
        it.done ? "bg-mint text-ink" : strength ? "bg-accent text-white" : "bg-ink text-white")}>
        {it.done ? <Check className="size-5" strokeWidth={3} /> : <Icon className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("eyebrow text-[10px]", strength && !it.done && "text-mint")}>{strength ? H.legendStrength : it.type ?? t.nav.client.running}{it.dow == null ? ` · ${H.flexible}` : ""}</div>
        <div className="mt-0.5 line-clamp-2 text-[17px] font-bold leading-snug">{it.title}</div>
        <div className={cn("text-sm", strength && !it.done ? "text-band-muted" : "text-muted")}>{it.done ? H.done : it.sub}</div>
      </div>
      <span className={cn("hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all sm:inline-flex",
        it.done ? "text-mint-ink" : strength ? "bg-mint text-ink group-hover:bg-white" : "bg-ink text-white group-hover:bg-accent")}>
        {it.done ? H.view : strength ? H.startWorkout : H.logRun}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
