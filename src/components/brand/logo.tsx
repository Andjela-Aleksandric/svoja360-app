import { cn } from "@/lib/utils/cn";

/** Same mark as the website: a raspberry ring with a mint segment, serif wordmark. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("logo-ring inline-block shrink-0 rounded-full transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)]", className)}
      style={{ width: size * 0.78, height: size * 0.78, border: `${Math.max(2, Math.round(size / 11))}px solid var(--color-accent)`, borderRightColor: "var(--color-mint)" }}
    />
  );
}

export function Logo({ size = 28, className, withText = true, inverted }: { size?: number; className?: string; withText?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("group/logo inline-flex items-center gap-2 [&:hover_.logo-ring]:rotate-[360deg]", className)}>
      <LogoMark size={size} />
      {withText && (
        <span className={cn("font-display leading-none", inverted ? "text-band-fg" : "text-ink")} style={{ fontSize: Math.round(size * 0.95) }}>
          SVOJA <span className={cn("italic", inverted ? "text-mint" : "text-accent")}>360</span>
        </span>
      )}
    </span>
  );
}
