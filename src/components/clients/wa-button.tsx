import { whatsappLink } from "@/lib/utils/phone";
import { t } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.04c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.6C5.75.6.63 5.72.63 12c0 2.01.52 3.97 1.52 5.7L.54 23.4l5.83-1.53a11.38 11.38 0 0 0 5.67 1.45h.01c6.28 0 11.4-5.12 11.4-11.4 0-3.05-1.18-5.91-3.35-8.07z" />
    </svg>
  );
}

export function WhatsAppButton({ phone, compact, className }: { phone: string | null | undefined; compact?: boolean; className?: string }) {
  const href = whatsappLink(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.common.whatsapp}
      title={t.common.whatsapp}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors",
        compact ? "size-9 text-[#1a8d4a] hover:bg-[#e6f6ec]" : "h-10 bg-[#e6f6ec] px-4 text-sm text-[#146c39] hover:bg-[#d5efdf]",
        className,
      )}
    >
      <WhatsAppIcon className={compact ? "size-[18px]" : "size-4"} />
      {!compact && t.common.whatsapp}
    </a>
  );
}
