import { ChevronRight } from "lucide-react";
import type { Customer, DateKey } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, relativeDay, formatTime } from "../../i18n/format";
import { fullName, type CustomerStats } from "../../selectors";
import { Badge } from "../../ui/badge";
import { ListRow } from "../../ui/list-row";

interface CustomerRowProps {
  customer: Customer;
  stats?: CustomerStats;
  today: DateKey;
  late: boolean;
  due: boolean;
}

/** A customer, their next booking, and their most recent visit. */
export function CustomerRow({ customer, stats, today, late, due }: CustomerRowProps) {
  const nextBooking = stats?.nextBooking;
  return (
    <ListRow href={`/studio/customers/${customer.id}`} helpId="customers.row"
      title={<span className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 break-words">{fullName(customer)}</span>
        {late && <Badge tone="warn">{t("customers.badge.late")}</Badge>}
        {due && <Badge>{t("customers.badge.due")}</Badge>}
      </span>}
      meta={<>
        {nextBooking && <>
          <span className="font-medium text-text">
            {t("customers.next", { when: `${relativeDay(nextBooking.date, today)} ${formatTime(nextBooking.start)}` })}
          </span>
          <span aria-hidden="true" className="hidden sm:inline"> · </span>
        </>}
        <span className="block sm:inline">
          {stats?.lastVisit ? t("customers.lastVisit", { ago: agoText(stats.lastVisit, today) }) : t("customers.noVisits")}
        </span>
      </>}
      trailing={<>
        <span className="hidden w-32 shrink-0 text-meta tabular-nums text-text-secondary sm:block">{customer.phone}</span>
        <span className="hidden w-20 shrink-0 text-right text-meta text-text-secondary sm:block">{tc("customers.visits", stats?.visits ?? 0)}</span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-text-secondary" />
      </>}
    />
  );
}
