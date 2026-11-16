"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserSearch } from "lucide-react";
import { t, tc } from "@/concept/i18n";
import { buildCustomerStats, fullName } from "@/concept/selectors";
import { CustomerRow } from "@/concept/studio/customers/customer-row";
import { FILTERS, filterCustomers, isFilter, type CustomerFilter } from "@/concept/studio/customers/customer-filters";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Card } from "@/concept/ui/card";
import { Chip, SearchInput } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";

const PAGE_SIZE = 60;

export default function CustomersPage() {
  const { state, today } = useStudio();
  const router = useRouter();
  const param = useSearchParams()?.get("filter") ?? null;
  const filter: CustomerFilter = isFilter(param) ? param : "all";
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const stats = useMemo(() => buildCustomerStats(state, today), [state, today]);
  const lists = useMemo(() => filterCustomers(state, stats, today), [state, stats, today]);
  const late = new Set(lists.late.map((c) => c.id));
  const due = new Set(lists.due.map((c) => c.id));
  const q = query.trim().toLowerCase();
  const matches = lists[filter].filter(
    (c) => !q || fullName(c).toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
  );

  return (
    <>
      <PageHeader
        title={t("customers.title")}
        subtitle={t("customers.subtitle", { count: state.customers.length, regulars: lists.regulars.length })}
      />
      <div className="mb-4 space-y-3">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("customers.search")} aria-label={t("customers.search")} />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={filter === f.value}
              count={lists[f.value].length}
              onClick={() => router.replace(f.value === "all" ? "/studio/customers" : `/studio/customers?filter=${f.value}`, { scroll: false })}
            >
              {t(f.label)}
            </Chip>
          ))}
        </div>
        {filter === "due" && <p className="text-sm text-eko-muted">{t("customers.dueHint")}</p>}
        {filter === "late" && <p className="text-sm text-eko-muted">{t("customers.lateHint")}</p>}
      </div>
      {matches.length ? (
        <Card className="divide-y divide-eko-line overflow-hidden">
          {matches.slice(0, limit).map((c) => (
            <CustomerRow key={c.id} customer={c} stats={stats.get(c.id)} today={today} late={late.has(c.id)} due={due.has(c.id)} />
          ))}
          {matches.length > limit && (
            <button onClick={() => setLimit(limit + PAGE_SIZE)} className="block w-full px-4 py-3.5 text-center text-sm font-medium text-eko-accent hover:bg-eko-sunken">
              {tc("customers.showMore", matches.length - limit)}
            </button>
          )}
        </Card>
      ) : (
        <EmptyState icon={<UserSearch size={22} />} title={t("customers.empty")} text={t("customers.emptyText")} />
      )}
    </>
  );
}
