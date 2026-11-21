"use client";
import * as React from "react";
import * as P from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { monthName, todayISO } from "@/lib/utils/format";
import { t } from "@/lib/i18n/sr";

type ChangeEvent = { target: { value: string; name?: string } };
interface BaseProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const pretty = (v: string) => { const [y, m, d] = v.split("-").map(Number); return `${d}. ${monthName(m - 1)} ${y}.`; };

const triggerCls =
  "group/dt ripple-host flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-left text-[16px] text-ink md:text-[15px] outline-none transition-[border-color,box-shadow] duration-200 hover:border-line-strong focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-accent-soft data-[state=open]:border-ink data-[state=open]:ring-4 data-[state=open]:ring-accent-soft disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger";
const panelCls =
  "z-[80] rounded-[22px] border border-line bg-surface p-3 shadow-[var(--shadow-pop)] outline-none data-[state=open]:animate-[dd-in_.22s_cubic-bezier(.2,.7,.2,1)] data-[state=closed]:animate-[dd-out_.12s_ease-in]";

function useValue(props: BaseProps) {
  const controlled = props.value !== undefined;
  const [inner, setInner] = React.useState(props.defaultValue ?? "");
  const value = controlled ? props.value ?? "" : inner;
  const set = (v: string) => { if (!controlled) setInner(v); props.onChange?.({ target: { value: v, name: props.name } }); };
  return [value, set] as const;
}

/** Calls onBlur after the popover closes, once the parent has the new value. */
function useBlurOnClose(open: boolean, onBlur?: () => void) {
  const was = React.useRef(false);
  React.useEffect(() => {
    if (was.current && !open) onBlur?.();
    was.current = open;
  }, [open, onBlur]);
}

export function DateInput(props: BaseProps & { min?: string; max?: string }) {
  const [value, set] = useValue(props);
  const [open, setOpen] = React.useState(false);
  useBlurOnClose(open, props.onBlur);
  return (
    <>
      <P.Root open={open} onOpenChange={setOpen}>
        <P.Trigger id={props.id} disabled={props.disabled} aria-label={props["aria-label"]} aria-invalid={props["aria-invalid"]} className={cn(triggerCls, props.className)}>
          <span className={cn("truncate tabular", !value && "text-faint")}>{value ? pretty(value) : props.placeholder ?? t.common.chooseDate}</span>
          <CalendarDays className="size-4 shrink-0 text-muted transition-all duration-300 group-hover/dt:text-accent group-data-[state=open]/dt:rotate-[-8deg] group-data-[state=open]/dt:text-accent" />
        </P.Trigger>
        <P.Portal>
          <P.Content align="start" sideOffset={6} collisionPadding={12} className={cn(panelCls, "w-[312px]")}>
            <Calendar value={value} min={props.min} max={props.max} onPick={(v) => { set(v); setOpen(false); }} />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <button type="button" onClick={() => { set(""); setOpen(false); }} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted hover:bg-hover hover:text-ink">{t.common.clear}</button>
              {(!props.max || todayISO() <= props.max) && (!props.min || todayISO() >= props.min) && (
                <button type="button" onClick={() => { set(todayISO()); setOpen(false); }} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-bold text-white transition-colors hover:bg-accent">{t.common.today}</button>
              )}
            </div>
          </P.Content>
        </P.Portal>
      </P.Root>
      {props.name && <input type="hidden" name={props.name} value={value} required={props.required} />}
    </>
  );
}

function Calendar({ value, min, max, onPick }: { value: string; min?: string; max?: string; onPick: (v: string) => void }) {
  const base = value || (max && todayISO() > max ? max : todayISO());
  const [y0, m0] = base.split("-").map(Number);
  const [view, setView] = React.useState({ y: y0, m: m0 - 1 });
  const [mode, setMode] = React.useState<"days" | "months" | "years">("days");
  const [dir, setDir] = React.useState(1);
  const today = todayISO();
  const go = (delta: number) => { setDir(delta); setView((v) => { const d = new Date(Date.UTC(v.y, v.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }); };
  const daysIn = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7; // Monday first
  const out = (d: string) => (min && d < min) || (max && d > max);
  const yNow = Number(today.slice(0, 4));
  const years = Array.from({ length: 100 }, (_, i) => yNow + 2 - i);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={t.common.previous} onClick={() => go(-1)} className="grid size-9 place-items-center rounded-full text-muted transition-all hover:-translate-x-0.5 hover:bg-hover hover:text-ink"><ChevronLeft className="size-4" /></button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMode(mode === "months" ? "days" : "months")} className="rounded-full px-2.5 py-1 font-display text-[21px] capitalize leading-none transition-colors hover:bg-hover hover:text-accent">{monthName(view.m)}</button>
          <button type="button" onClick={() => setMode(mode === "years" ? "days" : "years")} className="rounded-full px-2.5 py-1 font-display text-[21px] italic leading-none text-accent transition-colors hover:bg-accent-soft">{view.y}</button>
        </div>
        <button type="button" aria-label={t.common.next} onClick={() => go(1)} className="grid size-9 place-items-center rounded-full text-muted transition-all hover:translate-x-0.5 hover:bg-hover hover:text-ink"><ChevronRight className="size-4" /></button>
      </div>

      {mode === "months" && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, i) => (
            <button key={i} type="button" onClick={() => { setView({ ...view, m: i }); setMode("days"); }}
              className={cn("h-11 rounded-[12px] text-[13.5px] font-semibold capitalize transition-all hover:-translate-y-0.5 hover:bg-hover", i === view.m && "bg-ink text-white hover:bg-ink")}>{monthName(i, true)}</button>
          ))}
        </div>
      )}
      {mode === "years" && (
        <div className="no-scrollbar grid max-h-[264px] grid-cols-4 gap-1.5 overflow-y-auto py-1">
          {years.map((yy) => (
            <button key={yy} type="button" ref={(el) => { if (el && yy === view.y) el.scrollIntoView({ block: "center" }); }} onClick={() => { setView({ ...view, y: yy }); setMode("days"); }}
              className={cn("h-10 rounded-[12px] text-[13.5px] font-semibold tabular transition-all hover:bg-hover", yy === view.y && "bg-ink text-white hover:bg-ink")}>{yy}</button>
          ))}
        </div>
      )}
      {mode === "days" && (
        <>
          <div className="mb-1 grid grid-cols-7 text-center">
            {t.weekdaysShort.map((d) => <span key={d} className="eyebrow py-1 text-[10px]">{d}</span>)}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={`${view.y}-${view.m}`} custom={dir}
              initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
              {Array.from({ length: daysIn }, (_, i) => {
                const d = iso(view.y, view.m, i + 1);
                const sel = d === value, isToday = d === today, dis = out(d);
                return (
                  <button key={d} type="button" disabled={!!dis} onClick={() => onPick(d)} aria-pressed={sel} aria-label={pretty(d)}
                    className={cn("relative grid h-10 place-items-center rounded-full text-[14px] font-semibold tabular transition-all duration-200",
                      sel ? "bg-ink text-white shadow-[0_8px_18px_-10px_rgba(14,12,16,0.8)]" : "text-ink hover:scale-110 hover:bg-accent-soft hover:text-accent",
                      dis && "pointer-events-none text-faint/50",
                      isToday && !sel && "ring-[1.5px] ring-accent ring-inset")}>
                    {i + 1}
                    {isToday && <span className={cn("absolute bottom-1 size-1 rounded-full", sel ? "bg-mint" : "bg-accent")} />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

export function TimeInput(props: BaseProps) {
  const [value, set] = useValue(props);
  const [open, setOpen] = React.useState(false);
  useBlurOnClose(open, props.onBlur);
  const [h, m] = value ? value.split(":") : ["", ""];
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const mins = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  const col = (list: string[], cur: string, pick: (v: string) => void) => (
    <div className="no-scrollbar grid max-h-[232px] gap-0.5 overflow-y-auto pr-0.5">
      {list.map((v) => (
        <button key={v} type="button" ref={(el) => { if (el && v === cur && open) el.scrollIntoView({ block: "center" }); }} onClick={() => pick(v)}
          className={cn("h-9 rounded-[10px] px-3 text-[14px] font-semibold tabular transition-all", v === cur ? "bg-ink text-white" : "hover:bg-accent-soft hover:text-accent")}>{v}</button>
      ))}
    </div>
  );
  return (
    <>
      <P.Root open={open} onOpenChange={setOpen}>
        <P.Trigger id={props.id} disabled={props.disabled} aria-label={props["aria-label"]} className={cn(triggerCls, props.className)}>
          <span className={cn("tabular", !value && "text-faint")}>{value || "--:--"}</span>
          <Clock className="size-4 shrink-0 text-muted transition-all duration-500 group-hover/dt:text-accent group-data-[state=open]/dt:rotate-[360deg] group-data-[state=open]/dt:text-accent" />
        </P.Trigger>
        <P.Portal>
          <P.Content align="start" sideOffset={6} collisionPadding={12} className={cn(panelCls, "w-[196px]")}>
            <div className="grid grid-cols-2 gap-2">
              <div><div className="eyebrow mb-1 text-center text-[10px]">{t.common.hours}</div>{col(hours, h, (v) => set(`${v}:${m || "00"}`))}</div>
              <div><div className="eyebrow mb-1 text-center text-[10px]">{t.common.minutes}</div>{col(mins, m, (v) => { set(`${h || "08"}:${v}`); setOpen(false); })}</div>
            </div>
            {value && <button type="button" onClick={() => { set(""); setOpen(false); }} className="mt-2 w-full rounded-full py-1.5 text-[13px] font-semibold text-muted hover:bg-hover hover:text-ink">{t.common.clear}</button>}
          </P.Content>
        </P.Portal>
      </P.Root>
      {props.name && <input type="hidden" name={props.name} value={value} />}
    </>
  );
}
