"use client";
import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils/cn";

export const Dropdown = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ className, align = "end", children }: { className?: string; align?: "start" | "end" | "center"; children: React.ReactNode }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-[220px] overflow-hidden rounded-[18px] border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]",
          "origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-[dd-in_160ms_ease-out] data-[state=closed]:animate-[dd-out_120ms_ease-in]",
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function DropdownItem({ className, danger, ...props }: DM.DropdownMenuItemProps & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-[12px] px-3 text-sm font-semibold outline-none transition-[padding,background-color,color] duration-150 data-[highlighted]:pl-4 [&_svg]:size-4 [&_svg]:text-muted [&_svg]:transition-colors",
        danger ? "text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger" : "text-ink data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent data-[highlighted]:[&_svg]:text-accent",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownSeparator() {
  return <DM.Separator className="my-1 h-px bg-line" />;
}
