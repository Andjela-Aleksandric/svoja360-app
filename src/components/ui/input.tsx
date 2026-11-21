"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Select } from "./select";
import { DateInput, TimeInput } from "./date-input";

const fieldBase =
  "w-full rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-ink placeholder:text-faint transition-[border-color,box-shadow] duration-200 hover:border-line-strong focus:border-ink focus:outline-none focus:ring-4 focus:ring-accent-soft disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/10";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  if (props.type === "date" || props.type === "time") {
    const p = {
      id: props.id, name: props.name, disabled: props.disabled, required: props.required, className,
      value: props.value as string | undefined, defaultValue: props.defaultValue as string | undefined,
      placeholder: props.placeholder, "aria-label": props["aria-label"],
      "aria-invalid": props["aria-invalid"] === true || props["aria-invalid"] === "true" || undefined,
      onChange: props.onChange as unknown as (e: { target: { value: string; name?: string } }) => void,
      onBlur: props.onBlur ? () => (props.onBlur as unknown as () => void)() : undefined,
    };
    return props.type === "date"
      ? <DateInput {...p} min={props.min as string | undefined} max={props.max as string | undefined} />
      : <TimeInput {...p} />;
  }
  return <input ref={ref} className={cn(fieldBase, "h-12", className)} {...props} />;
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-[104px] py-3 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

/** Styled dropdown with the same API as a native <select> + <option> children. */
export const NativeSelect = Select;

export function InputWithUnit({ unit, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="relative">
      <Input className={cn("pr-14 tabular", className)} {...props} />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
    </div>
  );
}
