"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils/cn";

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <T.List className={cn("no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1", className)}>{children}</T.List>;
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <T.Trigger
      value={value}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold text-muted transition-colors hover:text-ink",
        "data-[state=active]:bg-ink data-[state=active]:text-white",
        className,
      )}
    >
      {children}
    </T.Trigger>
  );
}

/** URL-driven tabs (server-rendered pages). Active pill animates between items. */
export function LinkTabs({ items, active, layoutId = "link-tabs" }: { items: { key: string; label: string; href: string }[]; active: string; layoutId?: string }) {
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Sekcije">
      {items.map((i) => {
        const on = i.key === active;
        return (
          <Link
            key={i.key}
            href={i.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn("relative shrink-0 px-3 pb-3 pt-1 text-sm font-semibold transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}
          >
            {i.label}
            {on && <motion.span layoutId={layoutId} className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Segmented control (client state). */
export function Segmented<T extends string>({ options, value, onChange, className, size = "md" }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  const id = React.useId();
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-full bg-subtle p-1", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("relative whitespace-nowrap rounded-full font-semibold transition-colors", size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm", on ? "text-ink" : "text-muted hover:text-ink")}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
