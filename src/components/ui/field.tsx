import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-bold text-ink", className)} {...props} />;
}

interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  help?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, help, error, optional, className, children }: FieldProps) {
  const helpId = htmlFor ? `${htmlFor}-help` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {optional && <span className="ml-1.5 font-normal text-faint">(opciono)</span>}
        </Label>
      )}
      {children}
      {help && !error && <p id={helpId} className="text-[13px] leading-snug text-muted">{help}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
