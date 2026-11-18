"use client";

import { freeGaps } from "../../data/slots";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import { todayRevenue } from "../../selectors";
import { useStudio } from "../use-studio";

/** Two key numbers for today, set as plain text above the schedule: the day's bookings below are what matters. */
export function TodayStats() {
  const { state, today, minutes } = useStudio();
  const revenue = todayRevenue(state, today, minutes);
  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, today, { after: minutes, min: 30 }));
  const freeMinutes = gaps.reduce((sum, g) => sum + g.end - g.start, 0);

  return (
    <dl className="flex flex-wrap gap-x-12 gap-y-3">
      <div className="min-w-0">
        <dt className="text-sm text-text-secondary">{t("stats.revenue")}</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xl font-semibold tracking-tight">{formatMoney(revenue.earned)}</span>
          <span className="text-sm text-text-secondary">{t("stats.revenueOf", { amount: formatMoney(revenue.expected) })}</span>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-sm text-text-secondary">{t("stats.free")}</dt>
        <dd className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xl font-semibold tracking-tight">{gaps.length}</span>
          <span className="text-sm text-text-secondary">{freeMinutes ? formatDuration(freeMinutes) : t("stats.fullyBooked")}</span>
        </dd>
      </div>
    </dl>
  );
}
