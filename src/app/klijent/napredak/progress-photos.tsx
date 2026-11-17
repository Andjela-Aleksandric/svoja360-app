"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FileRow } from "@/lib/data/questionnaire";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { FileUpload } from "@/components/questionnaire/file-upload";
import { ConsentGate, useConsents } from "@/components/questionnaire/consent";
import { FilesGrid } from "@/components/files/files-grid";

type Signed = FileRow & { url: string | null };

/** Side-by-side comparison of two dates plus the full photo history. */
export function ProgressPhotos({ files, consent }: { files: Signed[]; consent: boolean }) {
  const router = useRouter();
  const { consents, set, pending } = useConsents({ health_data: false, photos_videos: consent, documents: false });
  const dates = useMemo(() => [...new Set(files.map((f) => f.taken_on ?? f.created_at.slice(0, 10)))].sort(), [files]);
  const [a, setA] = useState(dates[0] ?? "");
  const [b, setB] = useState(dates.at(-1) ?? "");
  const at = (d: string) => files.filter((f) => (f.taken_on ?? f.created_at.slice(0, 10)) === d);
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title={t.progress.addPhotos} />
        <CardBody>
          {consents.photos_videos ? <FileUpload kind="progress_photo" accept="image/*" angles={["front", "side", "back"]} files={[]} onChange={() => router.refresh()} context={{}} />
            : <ConsentGate type="photos_videos" pending={pending} onGrant={() => set("photos_videos", true)} />}
        </CardBody>
      </Card>
      {dates.length > 1 && (
        <Card>
          <CardHeader title={t.progress.compare} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {[{ v: a, set: setA }, { v: b, set: setB }].map((col, i) => (
                <div key={i} className="grid content-start gap-2">
                  <NativeSelect aria-label={t.common.date} value={col.v} onChange={(e) => col.set(e.target.value)} className="h-9 text-sm">{dates.map((d) => <option key={d} value={d}>{formatDate(d)}</option>)}</NativeSelect>
                  {at(col.v).map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.id} src={f.url ?? ""} alt={f.file_name} className="aspect-[3/4] w-full rounded-[14px] object-cover" />
                  ))}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
      <Card><CardHeader title={t.progress.photos} /><CardBody>{files.length ? <FilesGrid files={files} canDelete /> : <p className="text-sm text-muted">{t.progress.noPhotos}</p>}</CardBody></Card>
    </div>
  );
}
