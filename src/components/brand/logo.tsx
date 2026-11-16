import { cn } from "@/lib/utils/cn";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="12.5" fill="none" stroke="var(--color-ink)" strokeWidth="3.5" />
      <path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" fill="none" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28, className, withText = true }: { size?: number; className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} />
      {withText && (
        <span className="font-extrabold tracking-tight text-ink" style={{ fontSize: Math.round(size * 0.62) }}>
          SVOJA <span className="text-accent">360</span>
        </span>
      )}
    </span>
  );
}
