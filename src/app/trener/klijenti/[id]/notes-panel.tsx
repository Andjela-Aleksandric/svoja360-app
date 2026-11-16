"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pin, PinOff, Trash2, NotebookPen } from "lucide-react";
import type { NoteRow } from "@/lib/data/types";
import type { ActionResult } from "@/lib/actions";
import { t } from "@/lib/i18n/sr";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { addNoteAction, deleteNoteAction, toggleNotePinAction } from "../actions";

export function NotesPanel({ clientId, notes, authors, submissionId, compact }: { clientId: string; notes: NoteRow[]; authors: Record<string, string>; submissionId?: string; compact?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addNoteAction, null);
  const [busy, start] = useTransition();
  useEffect(() => {
    if (state?.ok) { formRef.current?.reset(); router.refresh(); }
    else if (state && !state.ok) toast(state.error, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const sorted = [...notes].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at));

  return (
    <Card>
      <CardHeader title={t.profile.notes.title} description={t.profile.notes.help} />
      <CardBody className="grid gap-4">
        <form ref={formRef} action={action} className="grid gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          {submissionId && <input type="hidden" name="submission_id" value={submissionId} />}
          <Textarea name="body" rows={compact ? 2 : 3} placeholder={t.profile.notes.placeholder} aria-label={t.profile.notes.add} required maxLength={5000} />
          <div className="flex justify-end"><Button type="submit" size="sm" loading={pending}>{t.profile.notes.add}</Button></div>
        </form>
        {sorted.length === 0 ? (
          <EmptyState icon={<NotebookPen />} title={t.profile.notes.empty} className="py-8" />
        ) : (
          <ul className="grid gap-2.5">
            {sorted.map((n) => (
              <li key={n.id} className={`rounded-[14px] border p-3.5 ${n.is_pinned ? "border-accent/30 bg-accent-soft/40" : "border-line bg-surface"}`}>
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{n.body}</p>
                <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                  {n.is_pinned && <Badge tone="accent">{t.profile.notes.pinned}</Badge>}
                  <span>{(n.created_by && authors[n.created_by]) || ""}{n.created_by && authors[n.created_by] ? " · " : ""}{formatDateTime(n.created_at)}</span>
                  <span className="ml-auto flex">
                    <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={n.is_pinned ? t.profile.notes.unpin : t.profile.notes.pin} title={n.is_pinned ? t.profile.notes.unpin : t.profile.notes.pin}
                      onClick={() => start(async () => { const r = await toggleNotePinAction(n.id, !n.is_pinned); if (r.ok) router.refresh(); else toast(r.error, "error"); })}>
                      {n.is_pinned ? <PinOff /> : <Pin />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled={busy} aria-label={t.common.delete}
                      onClick={() => start(async () => { const r = await deleteNoteAction(n.id); if (r.ok) router.refresh(); else toast(r.error, "error"); })}>
                      <Trash2 />
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
