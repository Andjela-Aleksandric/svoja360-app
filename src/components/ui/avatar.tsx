import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/format";

const palette = ["bg-[#f3e3ea] text-[#8f1d47]", "bg-[#e3efe9] text-[#1d5e44]", "bg-[#e7e8f3] text-[#33407a]", "bg-[#f4ece1] text-[#7a4c14]", "bg-[#ece6f3] text-[#5a3a7a]"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, src, size = 40, className }: { name: string | null | undefined; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span aria-hidden style={style} className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold", palette[hash(name ?? "") % palette.length], className)}>
      {initials(name)}
    </span>
  );
}
