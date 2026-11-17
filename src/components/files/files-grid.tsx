"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Film, MapPin, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { deleteFileAction } from "@/app/actions/questionnaire";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export interface GridFile { id: string; kind: string; file_name: string; mime_type: string; created_at: string; taken_on: string | null; photo_angle: "front" | "side" | "back" | null; url: string | null }

export function FilesGrid({ files, canDelete }: { files: GridFile[]; canDelete?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [del, setDel] = useState<GridFile | null>(null);
  const [pending, start] = useTransition();
  if (!files.length) return <p className="text-sm text-muted">{t.files.empty}</p>;
  const groups = Object.entries(files.reduce<Record<string, GridFile[]>>((acc, f) => ((acc[f.kind] ??= []).push(f), acc), {}));
  return (
    <div className="grid gap-5">
      {groups.map(([kind, list]) => (
        <div key={kind}>
          <div className="mb-2 text-[13px] font-semibold text-muted">{t.files.kinds[kind] ?? kind}</div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((f) => (
              <li key={f.id} className="group relative">
                <a href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[12px] border border-line bg-subtle">
                  {f.url && f.mime_type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.file_name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="grid aspect-[3/4] place-items-center p-2 text-center">
                      <div>
                        {f.mime_type.startsWith("video/") ? <Film className="mx-auto size-6 text-muted" /> : f.mime_type.includes("pdf") ? <FileText className="mx-auto size-6 text-muted" /> : <MapPin className="mx-auto size-6 text-muted" />}
                        <div className="mt-1.5 line-clamp-2 break-all text-[11px] text-ink-2">{f.file_name}</div>
                      </div>
                    </div>
                  )}
                </a>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span className="tabular">{formatDate(f.taken_on ?? f.created_at)}{f.photo_angle ? ` · ${t.questionnaire.angles[f.photo_angle]}` : ""}</span>
                  {canDelete && <button type="button" aria-label={`${t.common.delete}: ${f.file_name}`} onClick={() => setDel(f)} className="grid size-6 place-items-center rounded-full text-faint hover:bg-danger-soft hover:text-danger"><Trash2 className="size-3.5" /></button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={t.common.delete} description={t.files.deleteConfirm} confirmLabel={t.common.delete} loading={pending}
        onConfirm={() => del && start(async () => { const r = await deleteFileAction(del.id); if (r.ok) { toast(t.files.deleted); setDel(null); router.refresh(); } else toast(r.error, "error"); })} />
    </div>
  );
}
