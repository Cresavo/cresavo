"use client";

import { useMemo, useState } from "react";
import { addDays } from "../../data/dates";
import { buildOverview } from "../../finance/overview";
import { giftCardLiability } from "../../giftcards/cards";
import type { PeriodKey } from "../../finance/periods";
import { t, tc } from "../../i18n";
import { formatDayMonth, formatMoney, formatMonth, formatNumber } from "../../i18n/format";
import { packageLiability } from "../../packages/packages";
import { findService } from "../../selectors";
import { Card, Section } from "../../ui/card";
import { CompareBars, PairedColumns } from "../../ui/charts";
import { Segmented } from "../../ui/controls";
import { useStudio } from "../use-studio";
import { Delta } from "./delta";

const PERIODS: PeriodKey[] = ["day", "week", "month", "year"];
const percent = (share: number) => t("format.percent", { value: formatNumber(share * 100) });

/** "How is it going?" on one screen: each figure next to the period before. */
export function OverviewSection() {
  const { state, today, minutes } = useStudio();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const overview = useMemo(() => buildOverview(state, period, { today, minutes }), [state, period, today, minutes]);
  const { current, previous, ranges, series } = overview;
  const when = t(`finance.vs.${period}`);
  const lastDay = addDays(ranges.current.end, -1);
  const months = ranges.current.months;
  const chartLabels: [string, string] = months
    ? [`${formatMonth(months[0], true)} ${months[0].slice(2, 4)}`, `${formatMonth(months[months.length - 1], true)} ${months[months.length - 1].slice(2, 4)}`]
    : [formatDayMonth(ranges.current.start), formatDayMonth(lastDay)];
  const customers = current.newCustomers + current.returning;
  const gift = state.modules.giftcards ? giftCardLiability(state) : 0;
  const packages = state.modules.packages ? packageLiability(state) : 0;

  return (
    <div className="space-y-6">
      <Segmented
        label={t("finance.period")}
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p, label: t(`finance.period.${p}`) }))}
        className="w-full sm:w-auto"
      />
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-eko-muted">{t(`finance.span.${period}`)}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(current.revenue)}</p>
            <p className="mt-1 text-sm text-eko-muted">{t("finance.revenueBefore", { amount: formatMoney(previous.revenue), when })}</p>
          </div>
          <Delta current={current.revenue} previous={previous.revenue} />
        </div>
        {series.current.length > 0 && (
          <>
            <PairedColumns
              label={t("finance.revenue")}
              labels={chartLabels}
              data={series.current.map((value, i) => ({ current: value, previous: series.previous[i] ?? 0 }))}
            />
            <p className="text-xs text-eko-muted">{t("finance.legend", { when })}</p>
          </>
        )}
      </Card>
      {gift + packages > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 p-5">
          <div>
            <p className="text-sm text-eko-muted">{t("finance.prepaidTitle")}</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatMoney(gift + packages)}</p>
          </div>
          <p className="max-w-md text-sm text-eko-muted">{t("finance.prepaidText", { gift: formatMoney(gift), packages: formatMoney(packages) })}</p>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t("finance.occupancy")}>
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-eko-muted">{period === "year" ? t("finance.last90") : t("finance.occupancyNote")}</p>
              <Delta current={overview.occupancy.current.all} previous={overview.occupancy.previous.all} />
            </div>
            <CompareBars
              format={percent}
              data={overview.occupancy.current.byStaff.map((person, i) => ({
                id: person.id,
                label: person.name,
                value: person.value,
                previous: overview.occupancy.previous.byStaff[i].value,
                tone: person.id === "anna" ? "bg-eko-anna" : "bg-eko-erik",
              }))}
            />
          </Card>
        </Section>
        <Section title={t("finance.treatments")}>
          <Card className="space-y-4 p-5">
            <p className="text-sm text-eko-muted">{period === "year" ? t("finance.last90") : t("finance.treatmentsNote")}</p>
            <CompareBars
              format={(visits) => tc("finance.visits", visits)}
              data={overview.treatments.map((row) => ({ id: row.id, label: findService(state, row.id)?.name ?? row.id, value: row.visits, previous: row.previous }))}
            />
          </Card>
        </Section>
        <Section title={t("finance.cancellations")}>
          <Card className="grid grid-cols-2 gap-4 p-5">
            <Count label={t("finance.cancelled")} current={current.cancelled} previous={previous.cancelled} lowerIsBetter />
            <Count label={t("finance.noShows")} current={current.noShows} previous={previous.noShows} lowerIsBetter />
            <p className="col-span-2 text-xs text-eko-muted">{t("finance.compared", { when })}</p>
          </Card>
        </Section>
        <Section title={t("finance.customers")}>
          <Card className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <Count label={t("finance.new")} current={current.newCustomers} previous={previous.newCustomers} />
              <Count label={t("finance.returning")} current={current.returning} previous={previous.returning} />
            </div>
            {customers > 0 && (
              <div role="img" aria-label={t("finance.customers")} className="flex h-2 overflow-hidden rounded-full bg-eko-sunken">
                <div className="bg-eko-accent" style={{ width: `${(current.returning / customers) * 100}%` }} />
                <div className="bg-eko-erik" style={{ width: `${(current.newCustomers / customers) * 100}%` }} />
              </div>
            )}
            <p className="text-xs text-eko-muted">{t("finance.customersNote", { when })}</p>
          </Card>
        </Section>
      </div>
    </div>
  );
}

function Count({ label, current, previous, lowerIsBetter }: { label: string; current: number; previous: number; lowerIsBetter?: boolean }) {
  return (
    <div>
      <p className="text-sm text-eko-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{current}</span>
        <Delta current={current} previous={previous} count lowerIsBetter={lowerIsBetter} />
      </div>
    </div>
  );
}
