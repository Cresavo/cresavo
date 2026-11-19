import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Customer, DateKey } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, relativeDay, formatTime } from "../../i18n/format";
import { fullName, type CustomerStats } from "../../selectors";
import { Badge } from "../../ui/badge";

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
    <Link href={`/studio/customers/${customer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 break-words font-medium">{fullName(customer)}</span>
          {late && <Badge tone="warn">{t("customers.badge.late")}</Badge>}
          {due && <Badge>{t("customers.badge.due")}</Badge>}
        </div>
        <p className="text-sm text-text-secondary">
          {nextBooking && (
            <>
              <span className="font-medium text-text">
                {t("customers.next", { when: `${relativeDay(nextBooking.date, today)} ${formatTime(nextBooking.start)}` })}
              </span>
              <span aria-hidden="true" className="hidden sm:inline"> · </span>
            </>
          )}
          <span className="block sm:inline">
            {stats?.lastVisit ? t("customers.lastVisit", { ago: agoText(stats.lastVisit, today) }) : t("customers.noVisits")}
          </span>
        </p>
      </div>
      <span className="hidden w-32 shrink-0 text-sm tabular-nums text-text-secondary sm:block">{customer.phone}</span>
      <span className="hidden w-20 shrink-0 text-right text-sm text-text-secondary sm:block">{tc("customers.visits", stats?.visits ?? 0)}</span>
      <ChevronRight size={18} className="shrink-0 text-text-secondary" />
    </Link>
  );
}
