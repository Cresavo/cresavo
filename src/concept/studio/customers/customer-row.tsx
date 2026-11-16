import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatTime } from "../../data/dates";
import type { Customer, DateKey } from "../../data/types";
import { t, tc } from "../../i18n";
import { agoText, relativeDay } from "../../i18n/format";
import { fullName, type CustomerStats } from "../../selectors";
import { Avatar } from "../../ui/avatar";
import { Badge } from "../../ui/badge";

interface CustomerRowProps {
  customer: Customer;
  stats?: CustomerStats;
  today: DateKey;
  late: boolean;
  due: boolean;
}

/** One customer in the list: who, when last, when next. */
export function CustomerRow({ customer, stats, today, late, due }: CustomerRowProps) {
  return (
    <Link href={`/studio/customers/${customer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-eko-sunken">
      <Avatar name={fullName(customer)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium">{fullName(customer)}</span>
          {late && <Badge tone="warn">{t("customers.badge.late")}</Badge>}
          {due && <Badge tone="accent">{t("customers.badge.due")}</Badge>}
        </div>
        <p className="truncate text-sm text-eko-muted">
          {stats?.lastVisit ? t("customers.lastVisit", { ago: agoText(stats.lastVisit, today) }) : t("customers.noVisits")}
          {stats?.nextBooking && ` · ${t("customers.next", { when: `${relativeDay(stats.nextBooking.date, today)} ${formatTime(stats.nextBooking.start)}` })}`}
        </p>
      </div>
      <span className="hidden w-32 shrink-0 text-sm tabular-nums text-eko-muted sm:block">{customer.phone}</span>
      <span className="hidden w-20 shrink-0 text-right text-sm text-eko-muted sm:block">{tc("customers.visits", stats?.visits ?? 0)}</span>
      <ChevronRight size={18} className="shrink-0 text-eko-muted" />
    </Link>
  );
}
