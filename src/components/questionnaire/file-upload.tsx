"use client";
import { useRef, useState } from "react";
import { FileText, Film, ImageIcon, Loader2, Trash2, Upload, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { deleteFileAction, registerFileAction, type RegisterFileInput } from "@/app/actions/questionnaire";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  id: string;
  file_name: string;
  mime_type: string;
  photo_angle?: "front" | "side" | "back" | null;
  url?: string | null;
}

const MAX = 50 * 1024 * 1024;

export function FileUpload({
  kind, accept, multiple = true, angles, files, onChange, context, disabled,
}: {
  kind: RegisterFileInput["kind"];
  accept?: string;
  multiple?: boolean;
  angles?: ("front" | "side" | "back")[];
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  context: Pick<RegisterFileInput, "submissionId" | "questionId" | "diaryDayId">;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [angle, setAngle] = useState<"front" | "side" | "back" | undefined>(angles?.[0]);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    let current = [...files];
    for (const file of Array.from(list)) {
      if (file.size > MAX) { toast(t.validation.fileTooLarge(50), "error"); continue; }
      setBusy(file.name);
      const reg = await registerFileAction({ kind, fileName: file.name, mimeType: file.type, size: file.size, angle: angles ? angle : undefined, ...context });
      if (!reg.ok) { toast(reg.error, "error"); continue; }
      const supabase = createClient();
      const { error } = await supabase.storage.from("client-files").upload(reg.data.path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) {
        await deleteFileAction(reg.data.id);
        toast(t.errors.uploadFailed, "error");
        continue;
      }
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      current = multiple ? [...current, { id: reg.data.id, file_name: file.name, mime_type: file.type, photo_angle: angles ? angle : null, url: preview }] : [{ id: reg.data.id, file_name: file.name, mime_type: file.type, url: preview }];
      onChange(current);
      if (angles && angle) { const i = angles.indexOf(angle); setAngle(angles[(i + 1) % angles.length]); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
  }

  async function remove(f: UploadedFile) {
    setBusy(f.file_name);
    const res = await deleteFileAction(f.id);
    setBusy(null);
    if (!res.ok) { toast(res.error, "error"); return; }
    onChange(files.filter((x) => x.id !== f.id));
  }

  const canAdd = multiple || files.length === 0;

  return (
    <div className="grid gap-3">
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-[14px] border border-line bg-subtle">
              {f.url && f.mime_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.file_name} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="grid aspect-[3/4] place-items-center p-3 text-center">
                  <div>
                    {f.mime_type.startsWith("video/") ? <Film className="mx-auto size-7 text-muted" /> : f.mime_type.includes("pdf") ? <FileText className="mx-auto size-7 text-muted" /> : kind === "activity_file" ? <MapPin className="mx-auto size-7 text-muted" /> : <ImageIcon className="mx-auto size-7 text-muted" />}
                    <div className="mt-2 line-clamp-2 break-all text-xs font-medium text-ink-2">{f.file_name}</div>
                  </div>
                </div>
              )}
              {f.photo_angle && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">{t.questionnaire.angles[f.photo_angle]}</span>}
              {!disabled && (
                <button type="button" onClick={() => remove(f)} aria-label={`${t.common.remove}: ${f.file_name}`} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface/95 text-danger shadow-sm">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && canAdd && (
        <div className="grid gap-2">
          {angles && angles.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.questionnaire.chooseFile}>
              {angles.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={angle === a} onClick={() => setAngle(a)}
                  className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", angle === a ? "bg-ink text-white" : "bg-subtle text-muted hover:text-ink")}>
                  {t.questionnaire.angles[a]}
                </button>
              ))}
            </div>
          )}
          <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => upload(e.target.files)} tabIndex={-1} aria-hidden />
          <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={!!busy} className="w-full border-dashed sm:w-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? t.questionnaire.uploading : multiple ? t.questionnaire.chooseFiles : t.questionnaire.chooseFile}
          </Button>
          <p className="text-xs text-muted">{t.files.maxSize}</p>
        </div>
      )}
    </div>
  );
}
