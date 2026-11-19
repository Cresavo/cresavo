"use client";

import { phoneMatches } from "@/concept/booking/lookup";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, UserSearch } from "lucide-react";
import { t, tc } from "@/concept/i18n";
import { servedBy, staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { buildCustomerStats, fullName } from "@/concept/selectors";
import { CustomerRow } from "@/concept/studio/customers/customer-row";
import { FILTERS, filterCustomers, isFilter, type CustomerFilter } from "@/concept/studio/customers/customer-filters";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card } from "@/concept/ui/card";
import { SearchInput, SegmentedControl } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";

const PAGE_SIZE = 60;

export default function CustomersPage() {
  const { state: studio, today } = useStudio();
  const role = useRole();
  const viewer = role === "staff" ? staffViewer(studio) : null;
  const state = useMemo(() => {
    if (!viewer) return studio;
    const served = servedBy(studio, viewer.id);
    return { ...studio, customers: studio.customers.filter((c) => served.has(c.id)) };
  }, [studio, viewer]);
  const router = useRouter();
  const param = useSearchParams()?.get("filter") ?? null;
  const filter: CustomerFilter = isFilter(param) ? param : "all";
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const stats = useMemo(() => buildCustomerStats(state, today), [state, today]);
  const lists = useMemo(() => filterCustomers(state, stats, today), [state, stats, today]);
  const late = new Set(lists.notSeen.map((c) => c.id));
  const due = new Set(lists.due.map((c) => c.id));
  const q = query.trim().toLowerCase();
  const matches = lists[filter].filter(
    (c) => !q || fullName(c).toLowerCase().includes(q) || phoneMatches(c.phone, q),
  );

  if (state.industry && !studio.customers.length) {
    return <>
      <PageHeader title={t("customers.title")} />
      <EmptyState icon={<UserSearch size={22} />} title={t("setup.empty.customers")} action={viewer
        ? <ButtonLink href="/studio/calendar">{t("nav.calendar")}</ButtonLink>
        : <ButtonLink href="/studio/customers/import">{t("customers.import")}</ButtonLink>} />
    </>;
  }

  return (
    <>
      <PageHeader
        title={t("customers.title")}
        actions={viewer ? undefined : <ButtonLink href="/studio/customers/import" help="import-customers" icon={<Upload size={18} />}>{t("customers.import")}</ButtonLink>}
      />
      <div className="mb-4 space-y-3">
        <SearchInput className="md:max-w-form" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("customers.search")} aria-label={t("customers.search")} />
        <SegmentedControl<CustomerFilter>
          label={t("customers.filter")}
          value={filter}
          onChange={(next) => router.replace(next === "all" ? "/studio/customers" : `/studio/customers?filter=${next}`, { scroll: false })}
          options={FILTERS.map((f) => ({ value: f.value, label: t(f.label), count: lists[f.value].length }))}
        />
        {filter === "due" && (
          <p className="text-sm text-text-secondary">
            {t("customers.dueHint")}{" "}
            <Link href="/studio/customers/due-back" className="inline-flex min-h-target min-w-target items-center font-medium text-action hover:underline">{t("customers.dueLink")}</Link>
          </p>
        )}
        {filter === "notSeen" && <p className="text-sm text-text-secondary">{t("customers.notSeenHint")}</p>}
      </div>
      {matches.length ? (
        <Card className="divide-y divide-hairline overflow-hidden">
          {matches.slice(0, limit).map((c) => (
            <CustomerRow key={c.id} customer={c} stats={stats.get(c.id)} today={today} late={late.has(c.id)} due={due.has(c.id)} />
          ))}
          {matches.length > limit && (
            <Button variant="tertiary" onClick={() => setLimit(limit + PAGE_SIZE)} width="responsive">
              {tc("customers.showMore", matches.length - limit)}
            </Button>
          )}
        </Card>
      ) : (
        <EmptyState
          icon={<UserSearch size={22} />}
          title={t("customers.empty")}
          text={q ? t("customers.emptyText") : filter !== "all" ? t("customers.emptyFilter") : undefined}
          action={state.customers.length > 0 && <Button variant="secondary" onClick={() => {
            setQuery("");
            setLimit(PAGE_SIZE);
            if (filter !== "all") router.replace("/studio/customers", { scroll: false });
          }}>{t("customers.showAll")}</Button>}
        />
      )}
    </>
  );
}
