"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/input";
import { t } from "@/lib/i18n/sr";

export function PeriodSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <NativeSelect aria-label={t.common.period} value={value} className="w-auto" onChange={(e) => {
      const p = new URLSearchParams(sp.toString()); p.set("period", e.target.value); router.push(`?${p.toString()}`);
    }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </NativeSelect>
  );
}
