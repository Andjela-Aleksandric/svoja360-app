"use client";
import type { Consents } from "@/lib/data/questionnaire";
import { ConsentList, useConsents } from "@/components/questionnaire/consent";

export function ConsentSettings({ initial }: { initial: Consents }) {
  const { consents, set } = useConsents(initial);
  return <ConsentList consents={consents} onChange={set} />;
}
