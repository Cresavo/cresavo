"use client";

import { freeGaps } from "../../data/slots";
import { t } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import { todayRevenue } from "../../selectors";
import { Card } from "../../ui/card";
import { Meter } from "../../ui/charts";
import { useStudio } from "../use-studio";

/** Two key numbers for today. */
export function TodayStats() {
  const { state, today, minutes } = useStudio();
  const revenue = todayRevenue(state, today, minutes);
  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, today, { after: minutes, min: 30 }));
  const freeMinutes = gaps.reduce((sum, g) => sum + g.end - g.start, 0);

  // One quiet strip rather than two big cards: the day's bookings below are what matters.
  return (
    <Card className="grid grid-cols-2 divide-x divide-border">
      <div className="min-w-0 px-4 py-3">
        <p className="text-sm text-text-secondary">{t("stats.revenue")}</p>
        <p className="text-lg font-semibold tracking-tight">{formatMoney(revenue.earned)}</p>
        <Meter value={revenue.expected ? revenue.earned / revenue.expected : 0} className="mt-1.5" />
        <p className="mt-1 text-sm text-text-secondary">{t("stats.revenueOf", { amount: formatMoney(revenue.expected) })}</p>
      </div>
      <div className="min-w-0 px-4 py-3">
        <p className="text-sm text-text-secondary">{t("stats.free")}</p>
        <p className="text-lg font-semibold tracking-tight">{gaps.length}</p>
        <p className="mt-3 text-sm text-text-secondary">{freeMinutes ? formatDuration(freeMinutes) : t("stats.fullyBooked")}</p>
      </div>
    </Card>
  );
}
