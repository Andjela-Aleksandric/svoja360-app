"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CupSoda, Plus, Trash2, Utensils } from "lucide-react";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { formatWeekdayDate, todayISO } from "@/lib/utils/format";
import { addDiaryItemAction, deleteDiaryItemAction, saveDiaryDayAction, setDiaryDayDoneAction } from "@/app/actions/diary";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { FileUpload, type UploadedFile } from "@/components/questionnaire/file-upload";
import { ConsentGate, useConsents } from "@/components/questionnaire/consent";

export interface DiaryItem { id: string; eaten_at: string | null; food_name: string; quantity: string | null; is_drink: boolean; notes: string | null }
export interface DiaryDay { index: number; id: string | null; date: string; type: "weekday" | "weekend" | null; notes: string; done: boolean; items: DiaryItem[]; photos: UploadedFile[] }

export function DiaryEditor({ days, photoConsent }: { days: DiaryDay[]; photoConsent: boolean }) {
  const [active, setActive] = useState(() => (days.find((d) => !d.done) ?? days[0]).index);
  const done = days.filter((d) => d.done).length;
  const weekdays = days.filter((d) => d.type === "weekday").length;
  const weekends = days.filter((d) => d.type === "weekend").length;
  const mixOk = weekdays === 2 && weekends === 1;
  const day = days.find((d) => d.index === active)!;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.diary.title} description={t.diary.intro} />
      <div className="mb-5 grid gap-2">
        <div className="flex items-center justify-between text-[13px] font-semibold text-muted">
          <span>{t.diary.progress(done)}</span>
          {days.every((d) => d.type) && <span className={mixOk ? "text-success" : "text-warning"}>{mixOk ? t.diary.mixOk : t.diary.mixHint}</span>}
        </div>
        <ProgressBar value={done} max={3} tone="accent" label={t.diary.progress(done)} />
      </div>
      {done === 3 && <div className="mb-5 flex items-center gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-sm font-semibold text-success"><Check className="size-4" />{t.diary.done}</div>}

      <div role="tablist" className="mb-4 grid grid-cols-3 gap-2">
        {days.map((d) => (
          <button key={d.index} role="tab" aria-selected={d.index === active} onClick={() => setActive(d.index)}
            className={cn("rounded-[16px] border px-3 py-2.5 text-left transition-colors", d.index === active ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-line-strong")}>
            <div className="flex items-center justify-between text-sm font-bold">{t.diary.day(d.index)}{d.done && <Check className="size-4" />}</div>
            <div className={cn("mt-0.5 truncate text-xs", d.index === active ? "text-white/70" : "text-muted")}>{d.date ? formatWeekdayDate(d.date) : "–"}</div>
          </button>
        ))}
      </div>
      <DayEditor key={day.index + (day.id ?? "")} day={day} photoConsent={photoConsent} />
    </div>
  );
}

function DayEditor({ day, photoConsent }: { day: DiaryDay; photoConsent: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = useState(day.date);
  const [notes, setNotes] = useState(day.notes);
  const [dayId, setDayId] = useState(day.id);
  const [photos, setPhotos] = useState(day.photos);
  const [form, setForm] = useState({ eaten_at: "", food_name: "", quantity: "", is_drink: false, notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { consents, set: setConsent, pending: consentPending } = useConsents({ health_data: false, photos_videos: photoConsent, documents: false });

  async function ensureDay(): Promise<string | null> {
    const res = await saveDiaryDayAction(day.index, date, notes);
    if (!res.ok) { toast(res.error, "error"); return null; }
    setDayId(res.data.id);
    return res.data.id;
  }

  const addItem = () => start(async () => {
    if (!form.food_name.trim()) { setErr(t.validation.required); return; }
    const id = dayId ?? (await ensureDay());
    if (!id) return;
    const res = await addDiaryItemAction(id, form);
    if (!res.ok) { toast(res.error, "error"); return; }
    setForm({ eaten_at: form.eaten_at, food_name: "", quantity: "", is_drink: false, notes: "" });
    setErr(null);
    router.refresh();
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardBody className="grid gap-4 pt-5 sm:pt-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t.diary.date} htmlFor="diary_date">
              <Input id="diary_date" type="date" max={todayISO()} value={date} disabled={day.done}
                onChange={(e) => setDate(e.target.value)} onBlur={() => date !== day.date && start(async () => { if (await ensureDay()) router.refresh(); })} />
            </Field>
            {day.type && <Badge tone={day.type === "weekend" ? "accent" : "neutral"} className="mb-2.5">{t.diary.dayType[day.type]}</Badge>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5 sm:pt-6">
          {day.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">{t.diary.empty}</p>
          ) : (
            <ul className="-mx-1 grid">
              {day.items.map((it) => (
                <li key={it.id} className="flex items-start gap-3 rounded-[12px] px-1 py-2.5">
                  <span className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular text-muted">{it.eaten_at?.slice(0, 5) ?? "–"}</span>
                  <span className="mt-0.5 text-faint">{it.is_drink ? <CupSoda className="size-4" /> : <Utensils className="size-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{it.food_name}{it.quantity && <span className="font-normal text-muted"> · {it.quantity}</span>}</div>
                    {it.notes && <div className="text-[13px] text-muted">{it.notes}</div>}
                  </div>
                  {!day.done && (
                    <Button variant="ghost" size="icon-sm" aria-label={t.common.delete} disabled={pending}
                      onClick={() => start(async () => { const r = await deleteDiaryItemAction(it.id); if (r.ok) router.refresh(); else toast(r.error, "error"); })}><Trash2 /></Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!day.done && (
            <div className="mt-4 grid gap-3 rounded-[16px] bg-subtle/70 p-4">
              <div className="grid grid-cols-[96px_1fr] gap-3">
                <Field label={t.diary.time} htmlFor="eaten_at"><Input id="eaten_at" type="time" value={form.eaten_at} onChange={(e) => setForm({ ...form, eaten_at: e.target.value })} /></Field>
                <Field label={t.diary.food} htmlFor="food_name" error={err}><Input id="food_name" value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} maxLength={200} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} /></Field>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <Field label={t.diary.quantity} htmlFor="quantity"><Input id="quantity" value={form.quantity} placeholder={t.diary.quantityPlaceholder} onChange={(e) => setForm({ ...form, quantity: e.target.value })} maxLength={100} /></Field>
                <button type="button" aria-pressed={form.is_drink} onClick={() => setForm({ ...form, is_drink: !form.is_drink })}
                  className={cn("inline-flex h-11 items-center gap-2 rounded-[12px] border px-3.5 text-sm font-semibold", form.is_drink ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted")}>
                  <CupSoda className="size-4" />{t.diary.drink}
                </button>
              </div>
              <Field label={t.diary.notes} htmlFor="item_notes" optional><Input id="item_notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></Field>
              <Button type="button" onClick={addItem} loading={pending} variant="primary"><Plus className="size-4" />{t.diary.addItem}</Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-4 pt-5 sm:pt-6">
          <Field label={t.diary.dayNotes} htmlFor="day_notes" optional>
            <Textarea id="day_notes" rows={3} value={notes} disabled={day.done} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== day.notes && start(async () => { await ensureDay(); })} maxLength={2000} />
          </Field>
          <div className="grid gap-2">
            <div className="text-[13px] font-semibold">{t.diary.photos} <span className="font-normal text-faint">({t.common.optional})</span></div>
            {consents.photos_videos ? (
              dayId ? <FileUpload kind="meal_photo" accept="image/*" files={photos} onChange={setPhotos} context={{ diaryDayId: dayId }} disabled={day.done} />
                : <Button type="button" variant="secondary" onClick={() => start(async () => { await ensureDay(); })} loading={pending}>{t.diary.saveDay}</Button>
            ) : <ConsentGate type="photos_videos" pending={consentPending} onGrant={() => setConsent("photos_videos", true)} />}
          </div>
        </CardBody>
      </Card>

      <Button type="button" size="lg" variant={day.done ? "secondary" : "accent"} loading={pending}
        onClick={() => start(async () => {
          const id = dayId ?? (await ensureDay());
          if (!id) return;
          const r = await setDiaryDayDoneAction(id, !day.done);
          if (r.ok) { toast(day.done ? t.common.saved : t.diary.daySubmitted); router.refresh(); } else toast(r.error, "error");
        })}>
        {day.done ? t.diary.reopen : <><Check className="size-4" />{t.diary.submitDay}</>}
      </Button>
    </div>
  );
}
