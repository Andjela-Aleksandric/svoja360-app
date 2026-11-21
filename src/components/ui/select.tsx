"use client";
import * as React from "react";
import * as S from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const EMPTY = "__none__";

type Opt = { value: string; label: string; disabled?: boolean };

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

function optionsOf(children: React.ReactNode): Opt[] {
  const out: Opt[] = [];
  const walk = (n: React.ReactNode) => {
    React.Children.forEach(n, (c) => {
      if (!React.isValidElement(c)) return;
      const props = c.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
      if (c.type === "option") out.push({ value: String(props.value ?? textOf(props.children)), label: textOf(props.children), disabled: props.disabled });
      else if (props.children) walk(props.children);
    });
  };
  walk(children);
  return out;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  placeholder?: string;
}

/**
 * Styled select with the same API as a native <select> (value, defaultValue, onChange(e), name, <option> children),
 * so forms and existing call sites keep working. Opens a soft, animated list.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { id, name, value, defaultValue, onChange, disabled, required, className, children, placeholder, ...aria },
  ref,
) {
  const options = React.useMemo(() => optionsOf(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = controlled ? String(value) : inner;
  const toRadix = (v: string) => (v === "" ? EMPTY : v);
  const fromRadix = (v: string) => (v === EMPTY ? "" : v);
  const selected = options.find((o) => o.value === current);

  return (
    <>
      <S.Root
        value={toRadix(current)}
        disabled={disabled}
        onValueChange={(v) => {
          const real = fromRadix(v);
          if (!controlled) setInner(real);
          onChange?.({ target: { value: real, name } });
        }}
      >
        <S.Trigger
          ref={ref}
          id={id}
          aria-label={aria["aria-label"]}
          aria-invalid={aria["aria-invalid"]}
          className={cn(
            "group/sel ripple-host flex h-12 w-full min-w-0 items-center justify-between gap-2 rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-left text-[16px] text-ink md:text-[15px] outline-none transition-[border-color,box-shadow] duration-200",
            "hover:border-line-strong focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-accent-soft data-[state=open]:border-ink data-[state=open]:ring-4 data-[state=open]:ring-accent-soft",
            "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger",
            className,
          )}
        >
          <span className={cn("truncate", !selected?.label && "text-faint")}>{selected?.label || placeholder || "–"}</span>
          <S.Icon asChild>
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-data-[state=open]/sel:rotate-180 group-data-[state=open]/sel:text-accent" />
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            collisionPadding={12}
            className="z-[80] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[18px] border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)] data-[state=open]:animate-[dd-in_.22s_cubic-bezier(.2,.7,.2,1)] data-[state=closed]:animate-[dd-out_.12s_ease-in]"
          >
            <S.Viewport className="max-h-[inherit]">
              {options.map((o) => (
                <S.Item
                  key={o.value}
                  value={toRadix(o.value)}
                  disabled={o.disabled}
                  className="group/item relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[12px] py-2 pl-3 pr-9 text-[14.5px] text-ink outline-none transition-[background-color,padding] duration-150 data-[disabled]:opacity-40 data-[highlighted]:bg-hover data-[highlighted]:pl-4 data-[state=checked]:font-bold"
                >
                  <S.ItemText>{o.label || "–"}</S.ItemText>
                  <S.ItemIndicator className="absolute right-2.5 grid size-5 place-items-center rounded-full bg-mint">
                    <Check className="size-3 text-ink" strokeWidth={3} />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
      {name && <input type="hidden" name={name} value={current} required={required} />}
    </>
  );
});
