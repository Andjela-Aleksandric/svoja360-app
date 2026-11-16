"use client";
import * as React from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Radio from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function CheckboxField({ id, checked, onCheckedChange, label, description, name, disabled }: { id: string; checked: boolean; onCheckedChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode; name?: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-[14px] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong", checked && "border-ink", disabled && "opacity-60")}>
      <Checkbox.Root
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px] border-line-strong bg-surface transition-colors data-[state=checked]:border-ink data-[state=checked]:bg-ink"
      >
        <Checkbox.Indicator>
          <Check className="size-3.5 text-white" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <span className="grid gap-0.5">
        <span className="text-sm font-medium leading-snug text-ink">{label}</span>
        {description && <span className="text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function RadioCards({ name, value, onValueChange, options, columns = 1, required }: { name: string; value: string; onValueChange: (v: string) => void; options: { value: string; label: string; description?: string }[]; columns?: 1 | 2 | 3; required?: boolean }) {
  return (
    <Radio.Root name={name} value={value} onValueChange={onValueChange} required={required} className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "grid-cols-2 sm:grid-cols-3")}>
      {options.map((o) => (
        <Radio.Item
          key={o.value}
          value={o.value}
          className="group flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left transition-colors hover:border-line-strong data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-white"
        >
          <span className="grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong group-data-[state=checked]:border-white">
            <Radio.Indicator className="size-2 rounded-full bg-white" />
          </span>
          <span className="grid">
            <span className="text-sm font-semibold">{o.label}</span>
            {o.description && <span className="text-[13px] opacity-70">{o.description}</span>}
          </span>
        </Radio.Item>
      ))}
    </Radio.Root>
  );
}
