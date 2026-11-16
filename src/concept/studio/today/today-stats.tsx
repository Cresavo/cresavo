"use client";

import { freeGaps } from "../../data/slots";
import { t, tc } from "../../i18n";
import { formatDuration, formatMoney } from "../../i18n/format";
import { dayBookings, todayRevenue } from "../../selectors";
import { Card } from "../../ui/card";
import { Meter } from "../../ui/charts";
import { useStudio } from "../use-studio";

/** Three key numbers for today. */
export function TodayStats() {
  const { state, today, minutes } = useStudio();
  const revenue = todayRevenue(state, today, minutes);
  const bookings = dayBookings(state, today);
  const left = bookings.filter((b) => b.start + b.duration > minutes).length;
  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, today, { after: minutes, min: 30 }));
  const freeMinutes = gaps.reduce((sum, g) => sum + g.end - g.start, 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      <Card className="col-span-2 p-3.5 sm:col-span-1 sm:p-4">
        <p className="text-xs text-eko-muted sm:text-sm">{t("stats.revenue")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{formatMoney(revenue.earned)}</p>
        <Meter value={revenue.expected ? revenue.earned / revenue.expected : 0} className="mt-2" />
        <p className="mt-1.5 truncate text-xs text-eko-muted">{t("stats.revenueOf", { amount: formatMoney(revenue.expected) })}</p>
      </Card>
      <Card className="p-3.5 sm:p-4">
        <p className="text-xs text-eko-muted sm:text-sm">{t("stats.bookings")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{bookings.length}</p>
        <p className="mt-3.5 truncate text-xs text-eko-muted">{tc("stats.left", left)}</p>
      </Card>
      <Card className="p-3.5 sm:p-4">
        <p className="text-xs text-eko-muted sm:text-sm">{t("stats.free")}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{gaps.length}</p>
        <p className="mt-3.5 truncate text-xs text-eko-muted">{freeMinutes ? formatDuration(freeMinutes) : t("stats.fullyBooked")}</p>
      </Card>
    </div>
  );
}
