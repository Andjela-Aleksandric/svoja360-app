"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { ConsentType, Consents } from "@/lib/data/questionnaire";
import type { Question } from "@/lib/questionnaire/logic";
import { t } from "@/lib/i18n/sr";
import { setConsentAction } from "@/app/actions/questionnaire";
import { CheckboxField } from "@/components/ui/choice";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function consentFor(q: Question): ConsentType | null {
  if (q.type === "file") {
    const k = q.options?.kind;
    if (k === "assessment_photo" || k === "assessment_video" || k === "progress_photo") return "photos_videos";
    if (k === "lab_result") return "health_data";
    if (k === "document") return "documents";
    return null;
  }
  return q.sensitive ? "health_data" : null;
}

export function useConsents(initial: Consents) {
  const router = useRouter();
  const { toast } = useToast();
  const [consents, setConsents] = useState(initial);
  const [pending, start] = useTransition();
  const set = (type: ConsentType, granted: boolean) => {
    setConsents((c) => ({ ...c, [type]: granted }));
    start(async () => {
      const res = await setConsentAction(type, granted);
      if (!res.ok) { setConsents((c) => ({ ...c, [type]: !granted })); toast(res.error, "error"); }
      else { toast(granted ? t.consent.granted : t.consent.revoked); router.refresh(); }
    });
  };
  return { consents, set, pending };
}

export function ConsentList({ consents, onChange, types = ["health_data", "photos_videos", "documents"] }: { consents: Consents; onChange: (type: ConsentType, v: boolean) => void; types?: ConsentType[] }) {
  return (
    <div className="grid gap-2.5">
      {types.map((type) => (
        <CheckboxField key={type} id={`consent-${type}`} checked={consents[type]} onCheckedChange={(v) => onChange(type, v)} label={t.consent[type]} />
      ))}
    </div>
  );
}

export function ConsentGate({ type, onGrant, pending }: { type: ConsentType; onGrant: () => void; pending?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-subtle/60 p-3.5 sm:flex-row sm:items-center">
      <ShieldCheck className="size-5 shrink-0 text-muted" />
      <p className="flex-1 text-[13.5px] leading-snug text-ink-2">{t.consent[type]}</p>
      <Button type="button" size="sm" variant="secondary" onClick={onGrant} loading={pending}>{t.consent.give}</Button>
    </div>
  );
}
