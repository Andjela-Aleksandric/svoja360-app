import Link from "next/link";
import { ChevronRight, LayoutTemplate } from "lucide-react";
import type { ProgramListItem } from "@/lib/data/strength";
import { t } from "@/lib/i18n/sr";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";

const tone = { draft: "neutral", active: "success", completed: "info", archived: "outline" } as const;

export function ProgramsList({ items, basePath, showWeeks = true }: { items: ProgramListItem[]; basePath: string; showWeeks?: boolean }) {
  const clientItems = items.filter((i) => i.client_id && i.status !== "archived");
  const templates = items.filter((i) => !i.client_id && i.status !== "archived");
  const archived = items.filter((i) => i.status === "archived");
  if (!items.length) return <EmptyState icon={<LayoutTemplate />} title={t.strength.empty} />;
  const Section = ({ title, list }: { title: string; list: ProgramListItem[] }) => list.length ? (
    <section className="mb-6">
      <h2 className="mb-2.5 text-[15px] font-bold">{title} <span className="font-normal text-muted">· {list.length}</span></h2>
      <ul className="stagger overflow-hidden rounded-[20px] border border-line bg-surface">
        {list.map((p) => (
          <li key={p.id} className="border-b border-line/70 last:border-0">
            <Link href={`${basePath}/${p.id}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-hover sm:px-5">
              {p.client_name ? <Avatar name={p.client_name} size={36} /> : <span className="grid size-9 place-items-center rounded-full bg-subtle text-muted"><LayoutTemplate className="size-4" /></span>}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-xs text-muted">
                  {[p.client_name, showWeeks && p.weeks ? t.strength.weeksLabel(p.weeks) : null, p.start_date ? `${t.strength.startDate} ${formatDate(p.start_date)}` : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <Badge tone={tone[p.status]}>{t.strength.status[p.status]}</Badge>
              <ChevronRight className="size-4 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
  return (
    <>
      <Section title={t.strength.clientPrograms} list={clientItems} />
      <Section title={t.strength.templates} list={templates} />
      <Section title={t.strength.status.archived} list={archived} />
    </>
  );
}
