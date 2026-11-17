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

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <Card className="p-3.5 sm:p-4">
        <p className="text-xs text-eko-muted sm:text-sm">{t("stats.revenue")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{formatMoney(revenue.earned)}</p>
        <Meter value={revenue.expected ? revenue.earned / revenue.expected : 0} className="mt-2" />
        <p className="mt-1.5 truncate text-xs text-eko-muted">{t("stats.revenueOf", { amount: formatMoney(revenue.expected) })}</p>
      </Card>
      <Card className="p-3.5 sm:p-4">
        <p className="text-xs text-eko-muted sm:text-sm">{t("stats.free")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{gaps.length}</p>
        <p className="mt-3.5 truncate text-xs text-eko-muted">{freeMinutes ? formatDuration(freeMinutes) : t("stats.fullyBooked")}</p>
      </Card>
    </div>
  );
}
