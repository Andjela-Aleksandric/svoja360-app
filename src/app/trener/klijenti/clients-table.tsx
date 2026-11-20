"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Search, Users } from "lucide-react";
import type { ClientListItem } from "@/lib/data/clients";
import { t } from "@/lib/i18n/sr";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { formatPhone } from "@/lib/utils/phone";
import { Avatar } from "@/components/ui/avatar";
import { Input, NativeSelect } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckinBadge, ClientStatusBadge } from "@/components/clients/status";
import { WhatsAppButton } from "@/components/clients/wa-button";

type Filter = "active" | "inactive" | "archived" | "needsCheckin" | "all";
type Sort = "name" | "startDate" | "lastCheckin";

function fold(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj");
}

export function ClientsTable({ clients, periodStart }: { clients: ClientListItem[]; periodStart: string }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>("name");

  const checkinFor = (c: ClientListItem) => (c.lastCheckin && c.lastCheckin.period_start === periodStart ? c.lastCheckin.status : "missing");

  const rows = useMemo(() => {
    const needle = fold(q.trim());
    let list = clients.filter((c) => {
      if (filter === "needsCheckin") { if (c.status !== "active" || checkinFor(c) !== "missing") return false; }
      else if (filter !== "all" && c.status !== filter) return false;
      if (!needle) return true;
      return fold(`${c.full_name} ${c.email} ${c.phone ?? ""} ${c.phone_e164 ?? ""}`).includes(needle);
    });
    list = [...list].sort((a, b) => {
      if (sort === "startDate") return b.start_date.localeCompare(a.start_date);
      if (sort === "lastCheckin") return (b.lastCheckin?.period_start ?? "").localeCompare(a.lastCheckin?.period_start ?? "");
      return a.full_name.localeCompare(b.full_name, "sr");
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, q, filter, sort, periodStart]);

  const counts = useMemo(() => ({
    active: clients.filter((c) => c.status === "active").length,
    needsCheckin: clients.filter((c) => c.status === "active" && checkinFor(c) === "missing").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clients, periodStart]);

  if (clients.length === 0) {
    return <EmptyState icon={<Users />} title={t.clients.empty} action={<Link href="/trener/klijenti/novi" className="font-semibold text-accent">{t.clients.add}</Link>} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.clients.searchPlaceholder} className="pl-10" aria-label={t.common.search} type="search" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="no-scrollbar -mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: `${t.clients.filters.active} · ${counts.active}` },
              { value: "needsCheckin", label: `${t.clients.filters.needsCheckin} · ${counts.needsCheckin}` },
              { value: "inactive", label: t.clients.filters.inactive },
              { value: "archived", label: t.clients.filters.archived },
              { value: "all", label: t.clients.filters.all },
            ]}
          />
          </div>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t.common.sort} className="h-9 w-auto text-sm">
            <option value="name">{t.clients.sort.name}</option>
            <option value="startDate">{t.clients.sort.startDate}</option>
            <option value="lastCheckin">{t.clients.sort.lastCheckin}</option>
          </NativeSelect>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Search />} title={t.clients.emptySearch} />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          {/* Desktop table */}
          <table className="hidden w-full text-left text-sm lg:table">
            <thead className="border-b border-line text-xs font-semibold text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">{t.clients.columns.name}</th>
                <th className="px-3 py-3 font-semibold">{t.clients.columns.phone}</th>
                <th className="px-3 py-3 font-semibold">{t.clients.columns.startDate}</th>
                <th className="px-3 py-3 font-semibold">{t.clients.columns.program}</th>
                <th className="px-3 py-3 text-right font-semibold">{t.clients.columns.weight}</th>
                <th className="px-3 py-3 font-semibold">{t.clients.columns.checkinStatus}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="group border-b border-line/70 last:border-0 hover:bg-hover">
                  <td className="px-5 py-3">
                    <Link href={`/trener/klijenti/${c.id}`} className="group flex items-center gap-3">
                      <Avatar name={c.full_name} size={36} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">{c.email}</span>
                      </span>
                      {c.status !== "active" && <ClientStatusBadge status={c.status} />}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-ink-2 tabular">
                      {c.phone_e164 ? formatPhone(c.phone_e164) : <span className="text-faint">{t.common.notSet}</span>}
                      <WhatsAppButton phone={c.phone_e164} compact />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-2 tabular">{formatDate(c.start_date)}</td>
                  <td className="max-w-[220px] px-3 py-3">
                    <ProgramChips c={c} />
                  </td>
                  <td className="px-3 py-3 text-right tabular font-semibold">{c.latestWeight != null ? `${formatNumber(c.latestWeight)} kg` : <span className="font-normal text-faint">–</span>}</td>
                  <td className="px-3 py-3">{c.status === "active" ? <CheckinBadge status={checkinFor(c)} /> : <span className="text-faint">–</span>}</td>
                  <td className="pr-4"><Link href={`/trener/klijenti/${c.id}`} aria-label={c.full_name}><ChevronRight className="size-4 text-faint group-hover:text-ink" /></Link></td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <ul className="stagger divide-y divide-line lg:hidden">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-hover">
                <Link href={`/trener/klijenti/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={c.full_name} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{c.full_name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {c.status === "active" ? <CheckinBadge status={checkinFor(c)} /> : <ClientStatusBadge status={c.status} />}
                      {c.latestWeight != null && <span className="tabular">{formatNumber(c.latestWeight)} kg</span>}
                    </div>
                  </div>
                </Link>
                <WhatsAppButton phone={c.phone_e164} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProgramChips({ c }: { c: ClientListItem }) {
  const items = [
    c.programs.strength && { k: "S", label: c.programs.strength.name, title: t.nav.coach.strength },
    c.programs.running && { k: "T", label: c.programs.running.name, title: t.nav.coach.running },
    c.programs.nutrition && { k: "I", label: c.programs.nutrition.name, title: t.nav.coach.nutrition },
  ].filter(Boolean) as { k: string; label: string; title: string }[];
  if (!items.length) return <span className="text-faint">{t.profile.overview.noPrograms}</span>;
  return (
    <div className="grid gap-0.5">
      {items.map((it) => (
        <span key={it.k} title={it.title} className="truncate text-ink-2"><span className="mr-1.5 inline-grid size-4 place-items-center rounded bg-subtle text-[10px] font-bold text-muted">{it.k}</span>{it.label}</span>
      ))}
    </div>
  );
}
