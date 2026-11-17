"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { t } from "@/lib/i18n/sr";
import { markReviewedAction } from "@/app/actions/questionnaire";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReviewButton({ submissionId, reviewed }: { submissionId: string; reviewed: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  if (reviewed) return <Button variant="subtle" disabled><Check className="size-4" />{t.questionnaire.reviewed}</Button>;
  return (
    <Button variant="accent" loading={pending} onClick={() => start(async () => {
      const r = await markReviewedAction(submissionId);
      if (r.ok) { toast(t.questionnaire.reviewed); router.refresh(); } else toast(r.error, "error");
    })}><Check className="size-4" />{t.questionnaire.markReviewed}</Button>
  );
}
